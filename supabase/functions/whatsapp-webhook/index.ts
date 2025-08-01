import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configuração da Evolution API
const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
const webhookVerifyToken = Deno.env.get('WEBHOOK_VERIFY_TOKEN');
const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE_NAME');

interface EvolutionMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: {
    conversation?: string;
  };
  messageTimestamp: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (req.method === 'GET') {
      // Webhook verification for Evolution API
      const url = new URL(req.url)
      const token = url.searchParams.get('token')

      if (token === webhookVerifyToken) {
        console.log('Evolution API webhook verified successfully!')
        return new Response('Webhook verified', { status: 200 })
      } else {
        console.log('Failed webhook verification')
        return new Response('Forbidden', { status: 403 })
      }
    }

    if (req.method === 'POST') {
      const body = await req.json()
      console.log('Received Evolution API webhook:', JSON.stringify(body, null, 2))

      // Process Evolution API message events
      if (body.event === 'messages.upsert' && body.data) {
        const messageData = body.data
        
        // Check if message is not from the bot itself
        if (messageData.key.fromMe) {
          console.log('Message from bot, ignoring')
          return new Response('OK', { status: 200 })
        }

        const phoneNumber = messageData.key.remoteJid.split('@')[0]
        const messageText = messageData.message?.conversation?.toLowerCase() || ''

        if (!messageText) {
          console.log('No text message content')
          return new Response('OK', { status: 200 })
        }

        console.log(`Processing message from ${phoneNumber}: ${messageText}`)

        // Find user by phone number
        const { data: userData, error: userError } = await supabase
          .from('usuarios')
          .select('*')
          .eq('telefone_whatsapp', phoneNumber)
          .single()

        if (userError || !userData) {
          console.log('User not found for phone:', phoneNumber)
          // Send a welcome message for unregistered users
          await sendEvolutionMessage(phoneNumber, 
            "👋 Olá! Parece que você ainda não está cadastrado no nosso sistema financeiro.\n\n" +
            "Para começar a usar o bot, acesse nosso site e faça seu cadastro:\n" +
            "https://seu-dominio.com/\n\n" +
            "Após o cadastro, você poderá usar todos os recursos do bot! 🤖💰"
          )
          return new Response('OK', { status: 200 })
        }

        // Process the message and generate response
        const response = await processFinancialMessage(messageText, userData, supabase)
        
        // Send response back via Evolution API
        await sendEvolutionMessage(phoneNumber, response)

        return new Response(JSON.stringify({ status: 'success', response }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    return new Response('OK', { status: 200 })

  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function processFinancialMessage(message: string, user: any, supabase: any): Promise<string> {
  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()

  // RF2: Registrar despesa
  if (message.includes('gastei') || message.includes('gasto')) {
    const valueMatch = message.match(/(\d+(?:,\d{2})?|\d+(?:\.\d{2})?)/)
    const categoryMatch = message.match(/(?:em|com|de)\s+(.+)$/)
    
    if (valueMatch) {
      const valor = parseFloat(valueMatch[1].replace(',', '.'))
      const categoria = categoryMatch ? categoryMatch[1].trim() : 'outros'
      
      const { error } = await supabase
        .from('transacoes')
        .insert({
          usuario_id: user.id,
          valor: valor,
          tipo: 'despesa',
          categoria: categoria,
          descricao: message,
          data_transacao: new Date().toISOString()
        })

      if (error) {
        console.error('Error inserting expense:', error)
        return 'Ops! Não consegui registrar sua despesa. Tente novamente.'
      }

      return `✅ Despesa registrada!\n💰 Valor: R$ ${valor.toFixed(2)}\n📂 Categoria: ${categoria}\n📅 Data: ${new Date().toLocaleDateString('pt-BR')}`
    }
    return 'Por favor, informe o valor da despesa. Ex: "Gastei R$50 em almoço"'
  }

  // RF3: Registrar receita
  if (message.includes('recebi') || message.includes('receita') || message.includes('salário') || message.includes('salario')) {
    const valueMatch = message.match(/(\d+(?:,\d{2})?|\d+(?:\.\d{2})?)/)
    const descriptionMatch = message.match(/(?:de|meu|minha)\s+(.+)$/)
    
    if (valueMatch) {
      const valor = parseFloat(valueMatch[1].replace(',', '.'))
      const descricao = descriptionMatch ? descriptionMatch[1].trim() : 'receita'
      
      const { error } = await supabase
        .from('transacoes')
        .insert({
          usuario_id: user.id,
          valor: valor,
          tipo: 'receita',
          categoria: 'receita',
          descricao: message,
          data_transacao: new Date().toISOString()
        })

      if (error) {
        console.error('Error inserting income:', error)
        return 'Ops! Não consegui registrar sua receita. Tente novamente.'
      }

      return `✅ Receita registrada!\n💰 Valor: R$ ${valor.toFixed(2)}\n📝 Descrição: ${descricao}\n📅 Data: ${new Date().toLocaleDateString('pt-BR')}`
    }
    return 'Por favor, informe o valor da receita. Ex: "Recebi meu salário de R$3000"'
  }

  // RF4: Consultar saldo
  if (message.includes('saldo') || message.includes('quanto tenho')) {
    const { data: transacoes, error } = await supabase
      .from('transacoes')
      .select('valor, tipo')
      .eq('usuario_id', user.id)
      .gte('data_transacao', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
      .lt('data_transacao', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)

    if (error) {
      console.error('Error fetching balance:', error)
      return 'Erro ao consultar saldo. Tente novamente.'
    }

    const receitas = transacoes?.filter(t => t.tipo === 'receita').reduce((sum, t) => sum + parseFloat(t.valor), 0) || 0
    const despesas = transacoes?.filter(t => t.tipo === 'despesa').reduce((sum, t) => sum + parseFloat(t.valor), 0) || 0
    const saldo = receitas - despesas

    return `💰 Seu saldo atual (${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}):\n\n📈 Receitas: R$ ${receitas.toFixed(2)}\n📉 Despesas: R$ ${despesas.toFixed(2)}\n💳 Saldo: R$ ${saldo.toFixed(2)}`
  }

  // RF5: Gerar relatório
  if (message.includes('relatório') || message.includes('relatorio') || message.includes('resumo')) {
    const { data: transacoes, error } = await supabase
      .from('transacoes')
      .select('*')
      .eq('usuario_id', user.id)
      .gte('data_transacao', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
      .lt('data_transacao', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
      .order('data_transacao', { ascending: false })

    if (error) {
      console.error('Error fetching report:', error)
      return 'Erro ao gerar relatório. Tente novamente.'
    }

    const receitas = transacoes?.filter(t => t.tipo === 'receita') || []
    const despesas = transacoes?.filter(t => t.tipo === 'despesa') || []
    
    const totalReceitas = receitas.reduce((sum, t) => sum + parseFloat(t.valor), 0)
    const totalDespesas = despesas.reduce((sum, t) => sum + parseFloat(t.valor), 0)
    
    // Group expenses by category
    const despesasPorCategoria = despesas.reduce((acc: any, t) => {
      acc[t.categoria] = (acc[t.categoria] || 0) + parseFloat(t.valor)
      return acc
    }, {})

    let relatorio = `📊 Relatório Financeiro - ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}\n\n`
    relatorio += `💰 Resumo:\n📈 Total de Receitas: R$ ${totalReceitas.toFixed(2)}\n📉 Total de Despesas: R$ ${totalDespesas.toFixed(2)}\n💳 Saldo: R$ ${(totalReceitas - totalDespesas).toFixed(2)}\n\n`
    
    if (Object.keys(despesasPorCategoria).length > 0) {
      relatorio += `📂 Gastos por Categoria:\n`
      Object.entries(despesasPorCategoria).forEach(([categoria, valor]: [string, any]) => {
        relatorio += `• ${categoria}: R$ ${valor.toFixed(2)}\n`
      })
    }

    return relatorio
  }

  // RF6: Configurar meta
  if (message.includes('meta') && (message.includes('economizar') || message.includes('poupar'))) {
    const valueMatch = message.match(/(\d+(?:,\d{2})?|\d+(?:\.\d{2})?)/)
    
    if (valueMatch) {
      const valor = parseFloat(valueMatch[1].replace(',', '.'))
      
      const { error } = await supabase
        .from('metas')
        .insert({
          usuario_id: user.id,
          valor_alvo: valor,
          descricao_meta: message,
          status: 'ativa'
        })

      if (error) {
        console.error('Error setting goal:', error)
        return 'Erro ao definir meta. Tente novamente.'
      }

      return `🎯 Meta definida com sucesso!\n💰 Valor: R$ ${valor.toFixed(2)}\n📅 Mês: ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}\n\nVou te ajudar a acompanhar seu progresso!`
    }
    return 'Por favor, informe o valor da meta. Ex: "Quero economizar R$500 este mês"'
  }

  // RF9: Consulta por categoria
  const categoriaMatch = message.match(/quanto gastei (?:com|em|de)\s+(.+)/)
  if (categoriaMatch) {
    const categoria = categoriaMatch[1].trim()
    
    const { data: despesas, error } = await supabase
      .from('transacoes')
      .select('valor')
      .eq('usuario_id', user.id)
      .eq('tipo', 'despesa')
      .ilike('categoria', `%${categoria}%`)
      .gte('data_transacao', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
      .lt('data_transacao', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)

    if (error) {
      console.error('Error fetching category expenses:', error)
      return 'Erro ao consultar gastos por categoria. Tente novamente.'
    }

    const total = despesas?.reduce((sum, d) => sum + parseFloat(d.valor), 0) || 0

    return `📂 Gastos com "${categoria}" este mês:\n💰 Total: R$ ${total.toFixed(2)}\n📅 Período: ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
  }

  // RF8: Dicas financeiras (exemplo básico)
  if (message.includes('dica') || message.includes('ajuda') || message.includes('conselho')) {
    return `💡 Dica Financeira do Dia:\n\n"Registre todas suas despesas diariamente para ter controle total dos seus gastos. Pequenas despesas somam muito no final do mês!"\n\n📝 Comandos disponíveis:\n• "Gastei R$X em categoria" - registrar despesa\n• "Recebi R$X de fonte" - registrar receita\n• "Saldo" - consultar saldo atual\n• "Relatório" - ver resumo do mês\n• "Quero economizar R$X" - definir meta\n• "Quanto gastei com categoria" - gastos por categoria`
  }

  // Default response
  return `Olá ${user.nome}! 👋\n\nNão entendi sua mensagem. Aqui estão alguns comandos que você pode usar:\n\n💸 "Gastei R$50 em almoço"\n💰 "Recebi meu salário de R$3000"\n💳 "Qual meu saldo?"\n📊 "Gerar relatório"\n🎯 "Quero economizar R$500"\n📂 "Quanto gastei com alimentação?"\n💡 "Dicas"\n\nComo posso te ajudar hoje?`
}

// Função para enviar mensagens via Evolution API
async function sendEvolutionMessage(phoneNumber: string, message: string): Promise<void> {
  if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
    console.error('Evolution API configuration missing')
    return
  }

  try {
    const response = await fetch(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify({
        number: phoneNumber,
        text: message
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error sending message via Evolution API:', response.status, errorText)
    } else {
      console.log('Message sent successfully via Evolution API')
    }
  } catch (error) {
    console.error('Error sending message via Evolution API:', error)
  }
}
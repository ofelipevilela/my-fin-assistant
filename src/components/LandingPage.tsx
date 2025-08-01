import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Bot, DollarSign, Target, TrendingUp, Sparkles } from "lucide-react";

export const LandingPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    telefone_whatsapp: "",
    pin_seguranca: ""
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Primeiro, criar conta no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: `${formData.telefone_whatsapp}@finbot.com`, // Usar telefone como email único
        password: formData.pin_seguranca,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            nome: formData.nome,
            telefone_whatsapp: formData.telefone_whatsapp
          }
        }
      });

      if (authError) throw authError;

      // Depois, criar perfil na tabela usuarios
      const { error: profileError } = await supabase
        .from('usuarios')
        .insert({
          id: authData.user?.id,
          nome: formData.nome,
          telefone_whatsapp: formData.telefone_whatsapp,
          pin_seguranca: formData.pin_seguranca
        });

      if (profileError) throw profileError;

      toast({
        title: "Cadastro realizado com sucesso!",
        description: "Redirecionando para confirmação...",
      });

      // Redirecionar para página de confirmação
      navigate("/confirmacao");

    } catch (error: any) {
      toast({
        title: "Erro no cadastro",
        description: error.message || "Tente novamente",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-32 h-32 rounded-full bg-primary/10 blur-xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-48 h-48 rounded-full bg-secondary/10 blur-xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/3 w-24 h-24 rounded-full bg-accent/10 blur-xl animate-pulse delay-500"></div>
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
                <Bot className="h-10 w-10 text-white" />
              </div>
            </div>
          </div>
          <h1 className="text-6xl md:text-7xl font-black mb-4 tracking-tight">
            <span className="bg-gradient-to-r from-primary via-purple-400 to-secondary bg-clip-text text-transparent">
              FinBot
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-foreground/80 font-medium mb-6">
            Seu assistente financeiro inteligente
          </p>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Controle suas finanças, defina metas e receba insights personalizados via WhatsApp. 
            Tecnologia de ponta para revolucionar sua vida financeira.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-20">
          <div className="tech-card p-6 text-center group hover:shadow-xl transition-all duration-300">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/25 group-hover:scale-105 transition-transform duration-300">
              <DollarSign className="h-7 w-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-card-foreground">Controle Total</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Monitore receitas, despesas e categorize suas transações automaticamente
              com inteligência artificial avançada
            </p>
          </div>
          
          <div className="tech-card p-6 text-center group hover:shadow-xl transition-all duration-300">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/25 group-hover:scale-105 transition-transform duration-300">
              <Target className="h-7 w-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-card-foreground">Metas Inteligentes</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Defina objetivos financeiros e acompanhe seu progresso em tempo real
              com análises preditivas
            </p>
          </div>
          
          <div className="tech-card p-6 text-center group hover:shadow-xl transition-all duration-300">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/25 group-hover:scale-105 transition-transform duration-300">
              <TrendingUp className="h-7 w-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-card-foreground">Insights Personalizados</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Receba análises e dicas personalizadas direto no seu WhatsApp
              com relatórios automatizados
            </p>
          </div>
        </div>

        {/* Cadastro Form */}
        <div className="max-w-md mx-auto">
          <div className="tech-card p-6 md:p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl md:text-3xl font-bold mb-2 text-card-foreground">Comece Agora</h2>
              <p className="text-muted-foreground text-sm">
                Cadastre-se gratuitamente e transforme sua vida financeira
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="input-tech">
                <Label htmlFor="nome" className="text-card-foreground font-medium">Nome Completo</Label>
                <Input
                  id="nome"
                  type="text"
                  placeholder="Seu nome completo"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="mt-2 h-12 text-base"
                  required
                />
              </div>
              
              <div className="input-tech">
                <Label htmlFor="telefone" className="text-card-foreground font-medium">WhatsApp</Label>
                <Input
                  id="telefone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={formData.telefone_whatsapp}
                  onChange={(e) => setFormData({ ...formData, telefone_whatsapp: e.target.value })}
                  className="mt-2 h-12 text-base"
                  required
                />
              </div>
              
              <div className="input-tech">
                <Label htmlFor="pin" className="text-card-foreground font-medium">PIN de Segurança (6 dígitos)</Label>
                <Input
                  id="pin"
                  type="password"
                  placeholder="••••••"
                  maxLength={6}
                  value={formData.pin_seguranca}
                  onChange={(e) => setFormData({ ...formData, pin_seguranca: e.target.value })}
                  className="mt-2 h-12 text-base"
                  required
                />
              </div>
              
              <Button 
                type="submit" 
                className="btn-tech w-full h-14 text-lg font-bold" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                    Cadastrando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-3 h-5 w-5" />
                    Cadastrar Gratuitamente
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
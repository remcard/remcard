import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const themes = [
  { id: "normal", name: "Normal", description: "White and light purple" },
  { id: "midnight", name: "Midnight", description: "Dark grey with light blue" },
  { id: "magical", name: "Magical", description: "Dark purple theme" },
  { id: "sepia", name: "Sepia", description: "Warm sepia tones" },
  { id: "sage", name: "Sage", description: "Cream and light sage" },
];

const Settings = () => {
  const navigate = useNavigate();
  const [currentTheme, setCurrentTheme] = useState("normal");

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("theme")
          .eq("id", user.id)
          .single();
        
        const theme = profile?.theme || "normal";
        setCurrentTheme(theme);
        applyTheme(theme);
        localStorage.setItem("theme", theme);
      }
    } catch (error) {
      console.error("Failed to load theme:", error);
    }
  };

  const applyTheme = (theme: string) => {
    const root = document.documentElement;
    root.classList.remove("dark");
    root.removeAttribute("data-theme");

    if (theme === "midnight") {
      root.classList.add("dark");
    } else if (theme !== "normal") {
      root.setAttribute("data-theme", theme);
    }
  };

  const handleThemeChange = async (theme: string) => {
    setCurrentTheme(theme);
    localStorage.setItem("theme", theme);
    applyTheme(theme);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ theme })
          .eq("id", user.id);
      }
      toast.success("Theme updated!");
    } catch (error) {
      toast.error("Failed to save theme");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">Customize your study experience</p>
        </div>

        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Theme</CardTitle>
            <CardDescription>Choose your preferred color theme</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={currentTheme} onValueChange={handleThemeChange}>
              <div className="space-y-3">
                {themes.map((theme) => (
                  <div key={theme.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent/50 cursor-pointer">
                    <RadioGroupItem value={theme.id} id={theme.id} />
                    <Label htmlFor={theme.id} className="flex-1 cursor-pointer">
                      <div className="font-medium">{theme.name}</div>
                      <div className="text-sm text-muted-foreground">{theme.description}</div>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

      </main>
    </div>
  );
};

export default Settings;

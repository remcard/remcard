import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Brain, Plus, LogOut, BookOpen, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import SetCard from "@/components/SetCard";
import CreateSetDialog from "@/components/CreateSetDialog";


interface FlashcardSet {
  id: string;
  title: string;
  description: string | null;
  is_public?: boolean;
  created_at: string;
  flashcards: { count: number }[];
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      fetchSets();
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchSets = async () => {
    try {
      const { data, error } = await supabase
        .from("flashcard_sets")
        .select(`
          id,
          title,
          description,
          is_public,
          created_at,
          flashcards(count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSets(data || []);
    } catch (error: any) {
      toast.error("Failed to load flashcard sets");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Reset theme to default
      localStorage.setItem("theme", "normal");
      const root = document.documentElement;
      root.classList.remove("dark");
      root.removeAttribute("data-theme");
      
      navigate("/auth");
    } catch (error: any) {
      toast.error("Failed to sign out");
    }
  };

  const handleDeleteSet = async (setId: string) => {
    try {
      const { error } = await supabase
        .from("flashcard_sets")
        .delete()
        .eq("id", setId);

      if (error) throw error;
      toast.success("Set deleted");
      fetchSets();
    } catch (error: any) {
      toast.error("Failed to delete set");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Brain className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading your flashcards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-primary rounded-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Remcard</h1>
                <p className="text-sm text-muted-foreground">
                  Welcome back, {user?.user_metadata?.display_name || "Student"}!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => navigate("/settings")} size="sm">
                <SettingsIcon className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <Button variant="outline" onClick={handleSignOut} size="sm">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold">Your Flashcard Sets</h2>
            <p className="text-muted-foreground mt-1">
              Create and study your flashcard collections
            </p>
          </div>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="bg-gradient-primary hover:opacity-90 transition-opacity shadow-md"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Set
          </Button>
        </div>

        {sets.length === 0 ? (
          <div className="text-center py-16 animate-fade-in">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-4">
              <BookOpen className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No flashcard sets yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first set to start learning
            </p>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-gradient-primary hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Set
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sets.map((set, index) => (
              <div
                key={set.id}
                className="animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <SetCard
                  set={set}
                  onDelete={handleDeleteSet}
                  onStudy={() => navigate(`/study/${set.id}`)}
                  onEdit={() => navigate(`/set/${set.id}/edit`)}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      <CreateSetDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          setCreateDialogOpen(false);
          fetchSets();
        }}
      />
    </div>
  );
};

export default Dashboard;

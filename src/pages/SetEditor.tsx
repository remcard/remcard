import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import ImportFlashcardsDialog from "@/components/ImportFlashcardsDialog";

interface Flashcard {
  id?: string;
  term: string;
  definition: string;
  position: number;
  image_url?: string;
}

const SetEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([
    { term: "", definition: "", position: 0 },
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (id) {
      fetchSet();
    } else {
      setIsLoading(false);
    }
  }, [id]);

  const fetchSet = async () => {
    try {
      const { data: setData, error: setError } = await supabase
        .from("flashcard_sets")
        .select("*")
        .eq("id", id)
        .single();

      if (setError) throw setError;

      setTitle(setData.title);
      setDescription(setData.description || "");

      const { data: cardsData, error: cardsError } = await supabase
        .from("flashcards")
        .select("*")
        .eq("set_id", id)
        .order("position");

      if (cardsError) throw cardsError;

      if (cardsData.length > 0) {
        setFlashcards(cardsData);
      }
    } catch (error: any) {
      toast.error("Failed to load set");
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const addCard = () => {
    setFlashcards([
      ...flashcards,
      { term: "", definition: "", position: flashcards.length },
    ]);
  };

  const removeCard = (index: number) => {
    if (flashcards.length === 1) {
      toast.error("You must have at least one card");
      return;
    }
    setFlashcards(flashcards.filter((_, i) => i !== index));
  };

  const updateCard = (index: number, field: "term" | "definition" | "image_url", value: string) => {
    const updated = [...flashcards];
    updated[index][field] = value;
    setFlashcards(updated);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    const validCards = flashcards.filter(c => c.term.trim() && c.definition.trim());
    if (validCards.length === 0) {
      toast.error("Please add at least one complete flashcard");
      return;
    }

    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let setId = id;

      if (!setId) {
        // Create new set
        const { data, error } = await supabase
          .from("flashcard_sets")
          .insert({
            title,
            description,
            user_id: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        setId = data.id;
      } else {
        // Update existing set
        const { error } = await supabase
          .from("flashcard_sets")
          .update({ title, description })
          .eq("id", setId);

        if (error) throw error;

        // Delete existing cards
        const { error: deleteError } = await supabase
          .from("flashcards")
          .delete()
          .eq("set_id", setId);

        if (deleteError) throw deleteError;
      }

      // Insert cards
      const { error: cardsError } = await supabase
        .from("flashcards")
        .insert(
          validCards.map((card, index) => ({
            set_id: setId,
            term: card.term,
            definition: card.definition,
            position: index,
            image_url: card.image_url || null,
          }))
        );

      if (cardsError) throw cardsError;

      toast.success("Set saved successfully!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Failed to save set");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-gradient-primary hover:opacity-90 transition-opacity"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Set"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Set Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter set title..."
                className="text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={2}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Flashcards</h3>
              <div className="flex gap-2">
                {id && <ImportFlashcardsDialog setId={id} onSuccess={fetchSet} />}
                <Button onClick={addCard} size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Card
                </Button>
              </div>
            </div>

            {flashcards.map((card, index) => (
              <Card key={index} className="animate-slide-up">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1 space-y-4">
                      <div className="space-y-2">
                        <Label>Term</Label>
                        <Input
                          value={card.term}
                          onChange={(e) => updateCard(index, "term", e.target.value)}
                          placeholder="Enter term..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Definition</Label>
                        <Textarea
                          value={card.definition}
                          onChange={(e) => updateCard(index, "definition", e.target.value)}
                          placeholder="Enter definition..."
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Image URL (optional)</Label>
                        <Input
                          value={card.image_url || ""}
                          onChange={(e) => updateCard(index, "image_url", e.target.value)}
                          placeholder="https://example.com/image.jpg"
                        />
                        {card.image_url && (
                          <img 
                            src={card.image_url} 
                            alt="Preview" 
                            className="max-w-xs rounded-lg"
                          />
                        )}
                      </div>
                    </div>
                    {flashcards.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCard(index)}
                        className="hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SetEditor;

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Flashcard {
  id: string;
  term: string;
  definition: string;
  image_url?: string;
}

const TestMode = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [setTitle, setSetTitle] = useState("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [multipleChoiceOptions, setMultipleChoiceOptions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [typingMode, setTypingMode] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSetAndCards();
  }, [id]);

  useEffect(() => {
    if (flashcards.length > 0 && !typingMode) {
      generateMultipleChoice();
    }
  }, [currentIndex, flashcards, typingMode]);

  const fetchSetAndCards = async () => {
    try {
      const { data: setData, error: setError } = await supabase
        .from("flashcard_sets")
        .select("title")
        .eq("id", id)
        .maybeSingle();

      if (setError) throw setError;
      if (!setData) {
        toast.error("Set not found");
        navigate("/");
        return;
      }
      
      setSetTitle(setData.title);

      const { data: cardsData, error: cardsError } = await supabase
        .from("flashcards")
        .select("*")
        .eq("set_id", id)
        .order("position");

      if (cardsError) throw cardsError;
      if (cardsData.length === 0) {
        toast.error("This set has no flashcards");
        navigate("/");
        return;
      }

      setFlashcards(cardsData);
    } catch (error: any) {
      toast.error("Failed to load flashcards");
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const generateMultipleChoice = () => {
    const currentCard = flashcards[currentIndex];
    const otherDefinitions = flashcards
      .filter((_, i) => i !== currentIndex)
      .map(c => c.definition)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    const options = [currentCard.definition, ...otherDefinitions].sort(() => Math.random() - 0.5);
    setMultipleChoiceOptions(options);
  };

  const handleSubmit = () => {
    const currentCard = flashcards[currentIndex];
    let isCorrect = false;

    if (typingMode) {
      isCorrect = userAnswer.toLowerCase().trim() === currentCard.definition.toLowerCase().trim();
    } else {
      isCorrect = selectedOption === currentCard.definition;
    }

    const newAnswers = [...answers, isCorrect];
    setAnswers(newAnswers);

    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserAnswer("");
      setSelectedOption("");
    } else {
      setShowResults(true);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (showResults) {
    const score = answers.filter(a => a).length;
    const percentage = Math.round((score / flashcards.length) * 100);

    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md w-full text-center space-y-6">
          <h2 className="text-3xl font-bold">Test Complete!</h2>
          <div className="space-y-2">
            <div className="text-6xl font-bold text-primary">{percentage}%</div>
            <div className="text-muted-foreground">
              {score} out of {flashcards.length} correct
            </div>
          </div>
          <div className="space-y-2">
            {flashcards.map((card, i) => (
              <div
                key={card.id}
                className={cn(
                  "p-3 rounded-lg text-left",
                  answers[i] ? "bg-success/20" : "bg-destructive/20"
                )}
              >
                <div className="font-semibold">{card.term}</div>
                <div className="text-sm opacity-80">{card.definition}</div>
              </div>
            ))}
          </div>
          <Button onClick={() => navigate("/")} className="w-full">
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];
  const progress = ((currentIndex + 1) / flashcards.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Exit
            </Button>
            <div className="text-center">
              <h1 className="font-semibold">{setTitle} - Test Mode</h1>
              <p className="text-sm text-muted-foreground">
                Question {currentIndex + 1} / {flashcards.length}
              </p>
            </div>
            <Button variant="ghost" onClick={() => setTypingMode(!typingMode)}>
              {typingMode ? "Multiple Choice" : "Typing Mode"}
            </Button>
          </div>
          <Progress value={progress} className="mt-4 h-2" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <Card className="p-8 space-y-6">
          <div className="text-center space-y-4">
            <div className="text-sm text-muted-foreground">Define:</div>
            <div className="text-3xl font-bold">{currentCard.term}</div>
            {currentCard.image_url && (
              <img 
                src={currentCard.image_url} 
                alt={currentCard.term}
                className="max-w-md mx-auto rounded-lg"
              />
            )}
          </div>

          {typingMode ? (
            <div className="space-y-4">
              <Input
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && userAnswer && handleSubmit()}
                placeholder="Type your answer..."
                className="text-lg"
              />
              <Button
                onClick={handleSubmit}
                disabled={!userAnswer.trim()}
                className="w-full"
                size="lg"
              >
                Submit
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <RadioGroup value={selectedOption} onValueChange={setSelectedOption}>
                {multipleChoiceOptions.map((option, i) => (
                  <div key={i} className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent/50 cursor-pointer">
                    <RadioGroupItem value={option} id={`option-${i}`} />
                    <Label htmlFor={`option-${i}`} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <Button
                onClick={handleSubmit}
                disabled={!selectedOption}
                className="w-full"
                size="lg"
              >
                Submit
              </Button>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default TestMode;

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Trash2, Edit, Play, Zap, FileText, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SetCardProps {
  set: {
    id: string;
    title: string;
    description: string | null;
    flashcards: { count: number }[];
  };
  onDelete: (id: string) => void;
  onStudy: () => void;
  onEdit: () => void;
}

const SetCard = ({ set, onDelete, onStudy, onEdit }: SetCardProps) => {
  const navigate = useNavigate();
  const cardCount = set.flashcards[0]?.count || 0;

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-gradient-card border-border/50">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl line-clamp-2 group-hover:text-primary transition-colors">
              {set.title}
            </CardTitle>
            <CardDescription className="mt-2 line-clamp-2">
              {set.description || "No description"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <BookOpen className="w-4 h-4" />
          <span>{cardCount} {cardCount === 1 ? 'card' : 'cards'}</span>
        </div>
        
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              onClick={onStudy}
              className="flex-1 bg-gradient-primary hover:opacity-90 transition-opacity"
              disabled={cardCount === 0}
            >
              <Play className="w-4 h-4 mr-2" />
              Study
            </Button>
            <Button
              onClick={() => navigate(`/matching/${set.id}`)}
              variant="outline"
              disabled={cardCount === 0}
              className="flex-1"
            >
              <Zap className="w-4 h-4 mr-2" />
              Match
            </Button>
            <Button
              onClick={onEdit}
              variant="outline"
              size="icon"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" className="hover:bg-destructive hover:text-destructive-foreground">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this set?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{set.title}" and all its flashcards. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(set.id)}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => navigate(`/test/${set.id}`)}
              variant="outline"
              disabled={cardCount === 0}
              className="flex-1"
            >
              <FileText className="w-4 h-4 mr-2" />
              Test
            </Button>
            <Button
              onClick={() => navigate(`/gravity/${set.id}`)}
              variant="outline"
              disabled={cardCount === 0}
              className="flex-1"
            >
              <Rocket className="w-4 h-4 mr-2" />
              Gravity
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SetCard;

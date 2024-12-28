import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface Step {
  id: string;
  name: string;
  icon: LucideIcon;
}

interface ProgressStepsProps {
  steps: Step[];
  currentStep: number;
  completedSteps: string[];
  onStepClick?: (index: number) => void;
}

export function ProgressSteps({ steps, currentStep, completedSteps, onStepClick }: ProgressStepsProps) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol role="list" className="space-y-4 md:flex md:space-x-8 md:space-y-0">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = currentStep === index;
          const canNavigate = isCompleted || index === currentStep || (index === currentStep + 1 && completedSteps.includes(steps[currentStep].id));

          return (
            <li key={step.name} className="md:flex-1">
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "group relative flex w-full select-none flex-col border-l-4 py-2 pl-4 md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4",
                  isCompleted ? "border-primary" : isCurrent ? "border-primary/50" : "border-border",
                  canNavigate ? "cursor-pointer hover:bg-accent" : "cursor-not-allowed opacity-50"
                )}
                onClick={(e) => {
                  e.preventDefault();
                  if (canNavigate && onStepClick) {
                    onStepClick(index);
                  }
                }}
                disabled={!canNavigate}
              >
                <span className="text-sm font-medium">
                  <span className="flex items-center gap-3">
                    <span className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full",
                      isCompleted ? "bg-primary text-primary-foreground" :
                        isCurrent ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      {isCompleted ? (
                        <Check className="h-5 w-5 animate-in zoom-in duration-300" />
                      ) : (
                        <Icon className={cn(
                          "h-5 w-5",
                          isCurrent && "animate-pulse"
                        )} />
                      )}
                    </span>
                    <span className={cn(
                      "text-sm font-medium",
                      isCompleted ? "text-primary" :
                        isCurrent ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {step.name}
                    </span>
                  </span>
                </span>
              </Button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
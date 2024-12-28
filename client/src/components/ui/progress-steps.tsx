import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  name: string;
  icon: LucideIcon;
}

interface ProgressStepsProps {
  steps: Step[];
  currentStep: number;
  completedSteps: string[];
}

export function ProgressSteps({ steps, currentStep, completedSteps }: ProgressStepsProps) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol role="list" className="space-y-4 md:flex md:space-x-8 md:space-y-0">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = currentStep === index;

          return (
            <li key={step.name} className="md:flex-1">
              <div className={cn(
                "group flex flex-col border-l-4 py-2 pl-4 md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4",
                isCompleted ? "border-primary" : isCurrent ? "border-primary/50" : "border-border"
              )}>
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
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

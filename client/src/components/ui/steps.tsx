import { cn } from "@/lib/utils";

interface Step {
  title: string;
  description: string;
}

interface StepsProps {
  steps: Step[];
  currentStep: number;
}

export function Steps({ steps, currentStep }: StepsProps) {
  return (
    <div className="flex gap-4">
      {steps.map((step, index) => (
        <div
          key={step.title}
          className={cn(
            "flex-1",
            index !== steps.length - 1 &&
              "after:content-[''] after:w-full after:h-1 after:bg-muted after:absolute after:top-5 after:left-1/2 after:-translate-y-1/2"
          )}
        >
          <div className="relative flex flex-col items-center text-center gap-2">
            <div
              className={cn(
                "w-10 h-10 rounded-full border-2 flex items-center justify-center bg-background",
                currentStep === index
                  ? "border-primary text-primary"
                  : currentStep > index
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted text-muted-foreground"
              )}
            >
              {currentStep > index ? "✓" : index + 1}
            </div>
            <div className="space-y-1">
              <p
                className={cn(
                  "font-medium",
                  currentStep >= index
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {step.title}
              </p>
              <p className="text-sm text-muted-foreground">
                {step.description}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

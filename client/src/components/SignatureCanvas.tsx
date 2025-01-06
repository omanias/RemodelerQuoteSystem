import { useRef, useState } from "react";
import SignaturePad from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface SignatureCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signature: string) => void;
  title?: string;
  description?: string;
}

export function SignatureCanvas({
  isOpen,
  onClose,
  onSave,
  title = "Sign Document",
  description = "Please sign in the box below",
}: SignatureCanvasProps) {
  const signaturePad = useRef<SignaturePad>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const handleClear = () => {
    signaturePad.current?.clear();
    setIsEmpty(true);
  };

  const handleSave = () => {
    if (isEmpty) {
      toast({
        title: "Error",
        description: "Please provide a signature",
        variant: "destructive",
      });
      return;
    }

    const signatureData = signaturePad.current?.toDataURL();
    if (signatureData) {
      onSave(signatureData);
      handleClear();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="border rounded-lg p-4">
          <SignaturePad
            ref={signaturePad}
            canvasProps={{
              className: "signature-canvas w-full h-64 border rounded",
            }}
            onBegin={() => setIsEmpty(false)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClear}>
            Clear
          </Button>
          <Button onClick={handleSave}>Save Signature</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

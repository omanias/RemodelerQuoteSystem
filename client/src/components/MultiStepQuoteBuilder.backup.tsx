// Backup of MultiStepQuoteBuilder.tsx before implementing Smart Autosave Error Recovery
import { useState, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Steps } from "@/components/ui/steps";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Minus, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import debounce from "lodash/debounce";

// Rest of the current file content...
[Previous content of MultiStepQuoteBuilder.tsx]

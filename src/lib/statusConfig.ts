import { 
  Clock, 
  CheckCircle2, 
  RotateCcw, 
  XCircle, 
  Home,
  PhoneOff
} from "lucide-react";

export const STATUS_CONFIG = {
  pending: {
    label: "Attente",
    color: "#94a3b8",
    icon: Clock,
  },
  done: {
    label: "Fait",
    color: "#22c55e",
    icon: CheckCircle2,
  },
  retry_first: {
    label: "Repasse 1",
    color: "#f59e0b",
    icon: RotateCcw,
  },
  retry_second: {
    label: "Repasse 2",
    color: "#f97316",
    icon: RotateCcw,
  },
  refused: {
    label: "Refusé",
    color: "#ef4444",
    icon: XCircle,
  },
  uninhabited: {
    label: "Inhabité",
    color: "#64748b",
    icon: Home,
  },
  no_answer: {
    label: "Pas rép.",
    color: "#a855f7",
    icon: PhoneOff,
  },
} as const;

export type StatusType = keyof typeof STATUS_CONFIG;

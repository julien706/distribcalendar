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
    label: "En attente",
    color: "#94a3b8",
    icon: Clock,
  },
  done: {
    label: "Fait",
    color: "#22c55e",
    icon: CheckCircle2,
  },
  retry_first: {
    label: "À repasser 1ère fois",
    color: "#f59e0b",
    icon: RotateCcw,
  },
  retry_second: {
    label: "À repasser 2ème fois",
    color: "#f97316",
    icon: RotateCcw,
  },
  refused: {
    label: "Refus",
    color: "#ef4444",
    icon: XCircle,
  },
  uninhabited: {
    label: "Inhabité",
    color: "#64748b",
    icon: Home,
  },
  no_answer: {
    label: "Non répondu",
    color: "#a855f7",
    icon: PhoneOff,
  },
} as const;

export type StatusType = keyof typeof STATUS_CONFIG;

import { createFileRoute } from "@tanstack/react-router";
import { ScanView } from "~/features/scan/ScanView";

export const Route = createFileRoute("/binders/scan")({ component: ScanView });

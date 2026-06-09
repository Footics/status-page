import { getStatus } from "@/lib/betterstack";
import { StatusView } from "@/components/status-view";

export const dynamic = "force-dynamic";

export default async function Page() {
  const initial = await getStatus();
  return <StatusView initial={initial} />;
}

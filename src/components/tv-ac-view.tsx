import { GroupLevelsDashboard } from "@/components/group-dashboard";

/** صفحة TV — AC: للعرض فقط — الإدخال من صفحة Daily Editor حصرياً */
export function TvAcView() {
  return (
    <GroupLevelsDashboard
      pageLabel="TV — AC"
      deps={["TV", "AC"]}
      groupId="tv-ac"
      totalTitle="TV + AC"
    />
  );
}

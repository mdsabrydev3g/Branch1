import { GroupLevelsDashboard } from "@/components/group-dashboard";

/** صفحة MDA-SDA: نفس نظام TV-AC — للعرض فقط — الإدخال من Daily Editor */
export function MdaSdaView() {
  return (
    <GroupLevelsDashboard
      pageLabel="MDA-SDA"
      deps={["MDA", "SDA"]}
      groupId="mda-sda"
      totalTitle="MDA-SDA"
    />
  );
}

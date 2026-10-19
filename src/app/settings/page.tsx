import { redirect } from "next/navigation";
import { requireHousehold } from "@/server/session";

export default async function SettingsIndex() {
  const { household } = await requireHousehold("/settings");
  redirect(household.role === "admin" ? "/settings/household" : "/settings/profile");
}

import { requireHr } from "@/lib/auth";
import { isActiveOn } from "@/lib/auth/rules";
import { loadOrgData } from "@/lib/employees/queries";
import { EmployeeForm } from "@/components/employees/EmployeeForm";
import { EMPTY_EMPLOYEE } from "@/lib/employees/validation";
import { PageHead } from "@/components/ui";

export default async function NewEmployee() {
  const s = await requireHr();
  const { employees, departments, locations } = await loadOrgData();
  const managers = employees.filter((e) => isActiveOn(e, s.today)).map((e) => ({ id: e.id, label: `${e.full_name} (${e.employee_code})` }));
  return (
    <div>
      <PageHead title="Add employee" sub="Five steps. Every Indian ID is checked before you can continue." />
      <EmployeeForm mode="create" initial={{ ...EMPTY_EMPLOYEE, date_of_joining: s.today }} departments={departments} locations={locations} managers={managers} />
    </div>
  );
}

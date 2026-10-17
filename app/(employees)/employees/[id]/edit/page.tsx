import { notFound } from "next/navigation";
import { requireHr } from "@/lib/auth";
import { isActiveOn } from "@/lib/auth/rules";
import { getProfile, loadOrgData } from "@/lib/employees/queries";
import { EmployeeForm, EMPTY_EMPLOYEE } from "@/components/employees/EmployeeForm";
import { PageHead } from "@/components/ui";

export default async function EditEmployee({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireHr();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [profile, org] = await Promise.all([getProfile(id), loadOrgData()]);
  if (!profile) notFound();
  const e = profile.employee;
  const managers = org.employees.filter((m) => isActiveOn(m, s.today)).map((m) => ({ id: m.id, label: `${m.full_name} (${m.employee_code})` }));
  return (
    <div>
      <PageHead title={`Edit ${e.full_name}`} sub={<span className="mono">{e.employee_code} · code never changes</span>} />
      <EmployeeForm
        mode="edit"
        employeeId={e.id}
        departments={org.departments}
        locations={org.locations}
        managers={managers}
        masked={{ pan: profile.statutory.pan, aadhaar: profile.statutory.aadhaar, uan: profile.statutory.uan, account_number: profile.bank.account_number, ifsc: profile.bank.ifsc }}
        initial={{
          ...EMPTY_EMPLOYEE,
          full_name: e.full_name, email: e.email, mobile: e.mobile, dob: e.dob, gender: e.gender,
          address_line: e.address_line ?? "", city: e.city ?? "", state: e.state ?? "Goa", pin_code: e.pin_code ?? "",
          date_of_joining: e.date_of_joining, designation: e.designation, grade: e.grade ?? "",
          department_id: e.department_id, location_id: e.location_id, reporting_manager_id: e.reporting_manager_id ?? "",
          is_hr_admin: e.is_hr_admin, bank_name: profile.bank.bank_name === "—" ? "" : profile.bank.bank_name,
          emergency_name: e.emergency_name ?? "", emergency_relation: e.emergency_relation ?? "", emergency_mobile: e.emergency_mobile ?? "",
        }}
      />
    </div>
  );
}

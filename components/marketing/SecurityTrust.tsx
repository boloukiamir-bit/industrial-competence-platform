import { WarmSection } from "./WarmSection";
import { Shield, FileText, Users, MapPin } from "lucide-react";
import { ShieldLine } from "./illustrations";

const items = [
  { icon: Shield, title: "Row Level Security", description: "Data isolated by tenant. No cross-org access." },
  { icon: FileText, title: "Audit trails", description: "Changes and decisions logged for compliance and review." },
  { icon: Users, title: "Role-based access", description: "Admin, HR, manager, and user roles with clear boundaries." },
  { icon: MapPin, title: "Data residency", description: "Sweden and EU-ready. We align with your requirements." },
];

export function SecurityTrust() {
  return (
    <WarmSection variant="white" className="border-t border-black/5">
      <div id="security" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="rounded-2xl bg-[#f7f5f2] p-10 md:p-14 border border-black/5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10">
            <div>
              <div className="w-14 h-14 text-muted-foreground/50 flex items-center justify-center mb-4">
                <ShieldLine className="w-12 h-12" aria-hidden />
              </div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Security & trust</p>
              <h2 className="mt-2 font-display text-2xl md:text-3xl font-normal tracking-tight text-foreground">
                Built for industrial and compliance requirements
              </h2>
              <p className="mt-3 text-muted-foreground max-w-xl">
                No shortcuts. Audit trails, RLS, and clear roles.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 flex-1 md:pl-12">
              {items.map((item) => (
                <div key={item.title} className="rounded-xl bg-white p-5 border border-black/5 shadow-sm">
                  <item.icon className="h-5 w-5 text-muted-foreground" aria-hidden />
                  <h3 className="mt-3 font-semibold text-foreground text-sm">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </WarmSection>
  );
}

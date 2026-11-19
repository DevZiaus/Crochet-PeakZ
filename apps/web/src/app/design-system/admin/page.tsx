import type { Metadata } from "next";
import { Package, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Admin layout fixture",
};

const stats = [
  {
    label: "Orders today",
    value: "18",
    delta: "6 more than yesterday",
    icon: ShoppingCart,
  },
  {
    label: "Products live",
    value: "42",
    delta: "3 added this week",
    icon: Package,
  },
  {
    label: "Customers",
    value: "1,284",
    delta: "24 new this week",
    icon: Users,
  },
  {
    label: "Revenue this month",
    value: "৳184,500",
    delta: "12% up on last month",
    icon: TrendingUp,
  },
];

const recentOrders = [
  { id: "CPZ-2041", customer: "Amina Rahman", total: "৳3,200", status: "Paid" },
  {
    id: "CPZ-2040",
    customer: "Marco Rossi",
    total: "৳1,200",
    status: "Ready to ship",
  },
  {
    id: "CPZ-2039",
    customer: "Sadia Karim",
    total: "৳8,500",
    status: "Awaiting payment",
  },
];

/**
 * Temporary fixture route for the admin shell (spec 0003, AC-11). AdminLayout is
 * full viewport height (`h-dvh`), so it needs a route of its own to be driven at
 * desktop, collapsed and mobile widths. The real admin dashboard is a later
 * feature; the content below only stands in so the shell renders with something
 * inside it. Remove this route before the admin panel ships.
 */
export default function AdminLayoutFixture() {
  return (
    <AdminLayout>
      <PageHeader
        title="Dashboard"
        description="Fixture content for the admin layout. The real dashboard arrives with the admin features."
      >
        <Button variant="outline">Export orders</Button>
      </PageHeader>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                {stat.label}
              </CardTitle>
              <CardAction>
                <stat.icon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="font-heading text-2xl font-bold text-foreground">
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground">{stat.delta}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent orders</CardTitle>
          <CardDescription>
            The three most recent orders placed in the store.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <caption className="sr-only">Recent orders</caption>
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th scope="col" className="py-2 font-medium">
                  Order
                </th>
                <th scope="col" className="py-2 font-medium">
                  Customer
                </th>
                <th scope="col" className="py-2 font-medium">
                  Total
                </th>
                <th scope="col" className="py-2 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-3 font-medium text-foreground">
                    {order.id}
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {order.customer}
                  </td>
                  <td className="py-3 text-foreground">{order.total}</td>
                  <td className="py-3">
                    <Badge
                      variant={
                        order.status === "Paid" ? "default" : "secondary"
                      }
                    >
                      {order.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent>
          <EmptyState
            icon={Package}
            heading="No commission requests yet"
            description="Custom commission requests appear here once the commission flow ships."
          />
        </CardContent>
      </Card>
    </AdminLayout>
  );
}

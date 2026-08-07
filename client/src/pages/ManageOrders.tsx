import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Eye, Edit, Package, Calendar, User, DollarSign, Filter, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import { useLocation } from "wouter";

interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  productPrice: number;
  quantity: number;
  subtotal: number;
  productImageUrl?: string | null;
}

interface Order {
  id: number;
  userId: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  currency?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  shippingCountry?: string | null;
  shippingPhone?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
  user?: {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
  };
}

export default function ManageOrdersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editStatus, setEditStatus] = useState("");
  const [editPaymentStatus, setEditPaymentStatus] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [, navigate] = useLocation();

  // Fetch all orders (admin endpoint)
  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/admin/orders"],
    queryFn: async () => {
      const response = await fetch("/api/admin/orders", {
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to fetch orders");
      return response.json();
    },
  });

  // Update order mutation
  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, status, paymentStatus }: { id: number, status?: string, paymentStatus?: string }) => {
      const response = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ 
          status,
          paymentStatus,
          completedAt: status === 'delivered' ? new Date() : undefined
        }),
      });
      if (!response.ok) throw new Error("Failed to update order");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      toast({ title: t("orderUpdated") || "Order updated successfully" });
      setShowEditDialog(false);
      setSelectedOrder(null);
    },
    onError: () => {
      toast({ 
        title: t("orderUpdateFailed") || "Failed to update order",
        variant: "destructive" 
      });
    }
  });

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setShowDetailsDialog(true);
  };

  const handleEditOrder = (order: Order) => {
    setSelectedOrder(order);
    setEditStatus(order.status);
    setEditPaymentStatus(order.paymentStatus || 'pending');
    setShowEditDialog(true);
  };

  const handleSaveEdit = () => {
    if (!selectedOrder) return;
    updateOrderMutation.mutate({
      id: selectedOrder.id,
      status: editStatus as any,
      paymentStatus: editPaymentStatus
    });
  };

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
      processing: "bg-blue-100 text-blue-800 border-blue-300",
      shipped: "bg-indigo-100 text-indigo-800 border-indigo-300",
      delivered: "bg-green-100 text-green-800 border-green-300",
      cancelled: "bg-red-100 text-red-800 border-red-300"
    };
    return colors[status] || "bg-gray-100 text-gray-800 border-gray-300";
  };

  const getPaymentStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      paid: "bg-emerald-100 text-emerald-800 border-emerald-300",
      pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
      failed: "bg-red-100 text-red-800 border-red-300",
      refunded: "bg-purple-100 text-purple-800 border-purple-300"
    };
    return colors[status] || "bg-gray-100 text-gray-800 border-gray-300";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchQuery === "" || 
      order.id.toString().includes(searchQuery) ||
      order.user?.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.user?.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.user?.lastName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = selectedStatus === "all" || order.status === selectedStatus;
    const matchesPaymentStatus = selectedPaymentStatus === "all" || order.paymentStatus === selectedPaymentStatus;
    
    return matchesSearch && matchesStatus && matchesPaymentStatus;
  });

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/admin")}
          className="mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          {t("back") || "Back"}
        </Button>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">{t("manageOrders") || "Manage Orders"}</h1>
          <p className="text-gray-600">{t("manageOrdersDescription") || "View and manage all store orders"}</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t("searchOrders") || "Search orders..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allStatuses") || "All Statuses"}</SelectItem>
                  <SelectItem value="pending">{t("pending") || "Pending"}</SelectItem>
                  <SelectItem value="processing">{t("processing") || "Processing"}</SelectItem>
                  <SelectItem value="shipped">{t("shipped") || "Shipped"}</SelectItem>
                  <SelectItem value="delivered">{t("delivered") || "Delivered"}</SelectItem>
                  <SelectItem value="cancelled">{t("cancelled") || "Cancelled"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={selectedPaymentStatus} onValueChange={setSelectedPaymentStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allStatuses") || "All Statuses"}</SelectItem>
                  <SelectItem value="pending">{t("paymentPending") || "Pending"}</SelectItem>
                  <SelectItem value="paid">{t("paymentPaid") || "Paid"}</SelectItem>
                  <SelectItem value="failed">{t("paymentFailed") || "Failed"}</SelectItem>
                  <SelectItem value="refunded">{t("paymentRefunded") || "Refunded"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="ml-4 text-gray-500">{t("loadingOrders") || "Loading orders..."}</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t("noOrdersFound")}</h3>
            <p className="text-gray-500">{t("noOrdersDescription")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="flex items-center gap-3">
                      <Package className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">{t("orderId") || "Order ID"}</p>
                        <p className="font-semibold">#{order.id}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">{t("customer") || "Customer"}</p>
                        <p className="font-medium">
                          {order.user ? `${order.user.firstName} ${order.user.lastName}` : `User #${order.userId}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">{t("orderDate") || "Date"}</p>
                        <p className="font-medium">{formatDate(order.createdAt)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <DollarSign className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">{t("orderTotal") || "Total"}</p>
                        <p className="font-semibold">{order.total.toFixed(2)} {order.currency || 'EGP'}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500 mb-2">{t("status") || "Status"}</p>
                      <div className="space-y-1">
                        <Badge className={getStatusBadgeColor(order.status)}>
                          {t(order.status) || order.status}
                        </Badge>
                        <Badge className={getPaymentStatusBadgeColor(order.paymentStatus || 'pending')}>
                          {t(`payment${order.paymentStatus?.charAt(0).toUpperCase()}${order.paymentStatus?.slice(1)}`) || order.paymentStatus}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 lg:flex-shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewDetails(order)}
                      className="flex-1 lg:flex-initial"
                    >
                      <Eye className="w-4 h-4 mr-1 lg:mr-2" />
                      <span className="hidden sm:inline">{t("viewDetails") || "View Details"}</span>
                      <span className="sm:hidden">{t("view") || "View"}</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEditOrder(order)}
                      className="flex-1 lg:flex-initial"
                    >
                      <Edit className="w-4 h-4 mr-1 lg:mr-2" />
                      <span className="hidden sm:inline">{t("edit") || "Edit"}</span>
                      <span className="sm:hidden">{t("edit") || "Edit"}</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("orderDetails") || "Order Details"} - #{selectedOrder?.id}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              {/* Customer Info */}
              <div>
                <h3 className="font-semibold mb-2">{t("customerInformation")}</h3>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p><span className="font-medium">{t("name") || "Name"}:</span> {selectedOrder.user ? `${selectedOrder.user.firstName} ${selectedOrder.user.lastName}` : `User #${selectedOrder.userId}`}</p>
                  {selectedOrder.user && <p><span className="font-medium">{t("username") || "Username"}:</span> {selectedOrder.user.username}</p>}
                </div>
              </div>

              {/* Shipping Info */}
              <div>
                <h3 className="font-semibold mb-2">{t("shippingInformation") || "Shipping Information"}</h3>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  {selectedOrder.shippingAddress && <p><span className="font-medium">{t("address") || "Address"}:</span> {selectedOrder.shippingAddress}</p>}
                  {selectedOrder.shippingCity && <p><span className="font-medium">{t("city") || "City"}:</span> {selectedOrder.shippingCity}</p>}
                  {selectedOrder.shippingCountry && <p><span className="font-medium">{t("country") || "Country"}:</span> {selectedOrder.shippingCountry}</p>}
                  {selectedOrder.shippingPhone && <p><span className="font-medium">{t("phone") || "Phone"}:</span> {selectedOrder.shippingPhone}</p>}
                </div>
              </div>

              {/* Payment Info */}
              <div>
                <h3 className="font-semibold mb-2">{t("paymentInformation") || "Payment Information"}</h3>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p><span className="font-medium">{t("paymentMethod") || "Method"}:</span> {selectedOrder.paymentMethod === 'cod' ? t("cashOnDelivery") : t("cardPayment")}</p>
                  <p><span className="font-medium">{t("paymentStatus")}:</span> <Badge className={getPaymentStatusBadgeColor(selectedOrder.paymentStatus || 'pending')}>{selectedOrder.paymentStatus}</Badge></p>
                  <p><span className="font-medium">{t("total") || "Total"}:</span> {selectedOrder.total.toFixed(2)} {selectedOrder.currency || 'EGP'}</p>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="font-semibold mb-2">{t("orderItems") || "Order Items"}</h3>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center gap-3">
                        {item.productImageUrl && (
                          <img src={item.productImageUrl} alt={item.productName} className="w-12 h-12 object-cover rounded" />
                        )}
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-sm text-gray-500">{t("quantity") || "Qty"}: {item.quantity} × {item.productPrice.toFixed(2)} {selectedOrder.currency || 'EGP'}</p>
                        </div>
                      </div>
                      <p className="font-semibold">{item.subtotal.toFixed(2)} {selectedOrder.currency || 'EGP'}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div>
                  <h3 className="font-semibold mb-2">{t("notes") || "Notes"}</h3>
                  <p className="bg-gray-50 p-4 rounded-lg">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Dates */}
              <div>
                <h3 className="font-semibold mb-2">{t("timestamps")}</h3>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p><span className="font-medium">{t("createdAt")}:</span> {formatDate(selectedOrder.createdAt)}</p>
                  <p><span className="font-medium">{t("updatedAt")}:</span> {formatDate(selectedOrder.updatedAt)}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editOrder") || "Edit Order"} - #{selectedOrder?.id}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div>
                <Label>{t("orderStatus") || "Order Status"}</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{t("pending") || "Pending"}</SelectItem>
                    <SelectItem value="processing">{t("processing") || "Processing"}</SelectItem>
                    <SelectItem value="shipped">{t("shipped") || "Shipped"}</SelectItem>
                    <SelectItem value="delivered">{t("delivered") || "Delivered"}</SelectItem>
                    <SelectItem value="cancelled">{t("cancelled") || "Cancelled"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t("paymentStatus")}</Label>
                <Select value={editPaymentStatus} onValueChange={setEditPaymentStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{t("paymentPending") || "Pending"}</SelectItem>
                    <SelectItem value="paid">{t("paymentPaid") || "Paid"}</SelectItem>
                    <SelectItem value="failed">{t("paymentFailed") || "Failed"}</SelectItem>
                    <SelectItem value="refunded">{t("paymentRefunded") || "Refunded"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              {t("cancel") || "Cancel"}
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateOrderMutation.isPending}>
              {updateOrderMutation.isPending ? t("saving") || "Saving..." : t("save") || "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import Select from "react-select";
import mondaySdk from "monday-sdk-js";
import { Button } from "@/components/ui/button";
import toast, { Toaster } from "react-hot-toast";
import { useEffect, useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Order = {
  id: string;
  name: string;
  orderId: string;
  date: string;
  status: string;
  description: string;
  customerPostalCode: string;
  totalPrice: string;
};

type Supplier = {
  supplier_id: string;
  supplier_name: string;
  postal_code: string;
  supplier_address: string;
  supplier_phone: string;
  rate: string | null;
  weight: string;
  rating: string;
};

type Courier = {
  courier_id: string;
  courier_name: string;
  estimated_delivery_days: number;
  rating: number;
  freight_charge: number;
};

type LineItem = {
  id: string;
  name: string;
  product: string;
  product_id: string;
  sku: string;
  quantity: string;
  unitPrice: string;
  status: string;
  courierName?: string;
  supplierId?: string;
  supplierName?: string;
  courierId?: string;
  suppliers: Supplier[];
  availableCouriers?: Courier[];
};

type CustomerData = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  postal_code: string;
};

type ApiResponse = {
  order: Order;
  lineitems: LineItem[];
  customer: CustomerData;
};

type GroupedManifests = {
  key: string;
  supplierId: string;
  courierId: string;
  items: LineItem[];
};

export default function OrderDetail() {
  const [order, setOrder] = useState<Order | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [customer_info, setCustomerData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [buttonLoading, setButtonLoading] = useState(false);
  const [itemId, setItemId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false); 

  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  console.log('apiBaseUrl--->',apiBaseUrl);

  const monday = mondaySdk();

  //   useEffect(() => {

  //     monday.get("context").then((res) => {
  //       const context = res.data;

  //       if ("boardId" in context && "itemId" in context) {
  //           const boardId = Number(context.boardId);
  //           const itemId = Number(context.itemId);

  //           console.log("Board ID:", boardId);
  //           console.log("Item ID:", itemId);
  //           setItemId(itemId);
  //           fetchOrderWithLineItems(itemId);
  //       } else {
  //         console.warn("Board ID or Item ID not available in this context:", context);
  //       }
  //     });
  // }, []);

  useEffect(() => {
    const itemId = 2023614909;
    setItemId(itemId);
    fetchOrderWithLineItems(itemId);
  }, []);

  const totalQuantity: number = lineItems.reduce(
    (sum, item) => sum + Number(item.quantity),
    0
  );
  const totalAmount: number = lineItems.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
    0
  );

  const fetchOrderWithLineItems = async (itemId: number) => {
    try {
      setLoading(true);
      // const getResponse = await axios.get<ApiResponse>(
      //   "http://127.0.0.1:8000/order",
      //   { params: { itemId } }
      // );
      const res = await fetch(`https://monday-single-order-processing-k845.onrender.com/order?itemId=${itemId}`);
      if (!res.ok) throw new Error(`Error:-------> ${res.status}`);
      const data: ApiResponse = await res.json();

      console.log('orderDetails--->',data);
      setOrder(data.order);
      setLineItems(data.lineitems);
      setCustomerData(data.customer);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load order.");
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    console.log("inside this handleclick");
    const hasValidItem = lineItems.some(
      (item) =>
        item.supplierId &&
        item.courierId &&
        item.status !== "Manifest Generated"
    );

    console.log("hasValidItem-->", hasValidItem);

    if (!hasValidItem) {
      // alert("Please select supplier and courier for at least one order line item.");
      toast.error(
        "Please select supplier and courier for at least one order line item."
      );
      console.log("has valid item");

      return;
    }

    setDialogOpen(true);
  };

  const handleSupplierChange = async (itemId: string, supplierId: string) => {
    setLineItems((prev) =>
      prev.map((li) => (li.id === itemId ? { ...li, supplierId } : li))
    );

    if (!customer_info) return;
    const item = lineItems.find((li) => li.id === itemId);
    const supplier = item?.suppliers.find((s) => s.supplier_id === supplierId);
    if (!supplier) return;

    const payload = {
      supplier_postalcode: supplier.postal_code,
      customer_postalcode: customer_info.postal_code,
      weight: supplier.weight,
      cod: 1,
    };

    try {
      const res = await fetch("https://monday-single-order-processing-k845.onrender.com/get-couriers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      console.log("courer_data--->", data);

      const couriers =
        data.couriers?.data?.available_courier_companies?.map((c: any) => ({
          courier_id: c.courier_company_id,
          courier_name: c.courier_name,
          estimated_delivery_days: c.estimated_delivery_days,
          rating: c.rating,
          freight_charge: c.freight_charge,
        })) || [];

      console.log("couriers--->", couriers);

      const sortedCouriers = await fetch(
        "https://monday-single-order-processing-k845.onrender.com/sort_couriers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ couriers }),
        }
      );
      const sortdata = await sortedCouriers.json();
      console.log("sortdata--->", sortdata);

      setLineItems((prev) =>
        prev.map((li) =>
          li.id === itemId ? { ...li, availableCouriers: couriers } : li
        )
      );
    } catch (err) {
      console.error("Error fetching couriers:", err);
    }
  };

  const handleCourierChange = (itemId: string, courierId: string) => {
    setLineItems((prev) =>
      prev.map((li) => (li.id === itemId ? { ...li, courierId } : li))
    );
  };

  const groupLineItemsForManifest = (items: LineItem[]): GroupedManifests[] => {
    const groups: Record<string, GroupedManifests> = {};

    items.forEach((item) => {
      if (!item.supplierId || !item.courierId) return; // skip incomplete ones

      const key = `${item.supplierId}_${item.courierId}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          supplierId: item.supplierId,
          courierId: item.courierId,
          items: [],
        };
      }
      groups[key].items.push(item);
    });

    return Object.values(groups);
  };

  const handleGenerateManifestAndLabel = async () => {
    if (!lineItems.length || !customer_info) return;

    try {
      const pendingItems = lineItems.filter(
        (item) => item.status !== "Manifest Generated"
      );

      if (!pendingItems.length) {
        // alert("All manifests are already generated!");
        console.log("All manifests are already generated!");
        return;
      }
      const manifests = groupLineItemsForManifest(pendingItems);

      for (const manifest of manifests) {
        const normalizedSupplierId = Array.isArray(manifest.supplierId)
          ? manifest.supplierId[0]
          : manifest.supplierId;

        const supplier = manifest.items[0]?.suppliers.find(
          (s) => String(s.supplier_id) === String(normalizedSupplierId)
        );
        console.log("supplier8787---->", supplier);

        const courier = manifest.items[0]?.availableCouriers?.find(
          (c) => String(c.courier_id) === String(manifest.courierId)
        );
        console.log("courier8787---->", courier);

        // Manifest payload
        const manifestPayload = {
          supplierId: normalizedSupplierId,
          supplierName: supplier?.supplier_name || "",
          supplierAddress: supplier?.supplier_address || "",
          supplierPhone: supplier?.supplier_phone || "",
          courierId: manifest.courierId,
          courierName: courier?.courier_name || "",
          customer: customer_info,
          lineitems: manifest.items,
        };

        console.log("manifestPayload---->", manifestPayload);

        // Generate manifest PDF
        const manifestResponse = await fetch("https://monday-single-order-processing-k845.onrender.com/generate-manifest", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(manifestPayload),
        });
        const manifest = await manifestResponse.json();
        console.log("manifest--->", manifest);
        // if (!manifestResponse.ok) {
        //   throw new Error(`Manifest generation failed: ${manifestResponse.status}`);
        // }

        // Label payload
        const labelPayload = {
          supplierId: normalizedSupplierId,
          supplierName: supplier?.supplier_name || "",
          supplierAddress: supplier?.supplier_address || "",
          supplierPhone: supplier?.supplier_phone || "",
          courierId: manifest.courierId,
          courierName: courier?.courier_name || "",
          customer: customer_info,
          lineitems: manifest.items,
        };

        console.log("labelPayload---->", labelPayload);

        const labelResponse = await fetch("https://monday-single-order-processing-k845.onrender.com/generate-label", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(manifestPayload),
        });
        if (!labelResponse.ok) {
          throw new Error(`Manifest generation failed: ${labelResponse.status}`);
        }
      }

      // alert("Manifests and Labels generated successfully");
      toast.success("Manifests and Labels generated successfully!");
    } catch (error) {
      console.error("Error generating manifest/label:", error);
      // alert("Failed to generate manifest/label");
      toast.error("Failed to generate manifest/label");
    }
  };

  const handleConfirm = async () => {
    setDialogOpen(false);
    setProcessing(true);
    try {
      setButtonLoading(true); // start spinner for button
      await handleGenerateManifestAndLabel();
      setLineItems((prev) =>
      prev.map((item) =>
        item.supplierId && item.courierId && item.status !== "Manifest Generated"
          ? { ...item, status: "Manifest Generated" }
          : item
      )
    );
    setTimeout(() => fetchOrderWithLineItems(itemId!), 1000);
      // await fetchOrderWithLineItems(itemId!);
    } finally {
      setButtonLoading(false); // stop spinner
      setProcessing(false);
    }
  };

  const allGenerated = lineItems.every(
    (item) => item.status === "Manifest Generated"
  );

  return (
    <div className="relative">
      <div>
        <Toaster position="top-right" reverseOrder={true} />\
      </div>

      {/* Loading overlay */}

      {loading && (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-200 bg-opacity-70 z-[9999]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600 mb-4"></div>
          <p className="text-black font-medium text-lg">
            Please wait, loading your data...
          </p>
        </div>
      )}

      {/* Processing overlay while generating manifest */}
      {processing && (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-transparent backdrop-blur-[1px] z-[9999] pointer-events-auto">
          {/* transparent overlay that blocks interaction */}
          <div className="absolute inset-0 bg-white/30 backdrop-blur-sm pointer-events-none"></div>

          {/* Spinner + message */}
          <div className="relative flex flex-col items-center justify-center space-y-3">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600"></div>
            <p className="text-gray-800 font-medium text-lg drop-shadow-sm">
              Generating Manifest & Label, please wait...
            </p>
          </div>
        </div>
      )}

      {!loading && (
        <div className="p-6 grid gap-6 max-w-6xl mx-auto">
          {order && (
            <Card className="shadow-lg rounded-2xl border border-gray-200">
              <CardHeader>
                <CardTitle className="text-xl font-bold flex justify-between items-center">
                  Order #{order.name}
                  <span className="text-sm font-medium text-gray-600">
                    {/* {order.status} */}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-y-1 text-sm">
                <p>
                  <b>Date:</b> {order.date}
                </p>
                <p>
                  <b>Total Order Value:</b> ${order.totalPrice}
                </p>
                <p>
                  <b>Description:</b> {order.description}
                </p>
                <p>
                  <b>Customer Postal Code:</b> {order.customerPostalCode}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Customer Info  */}
          {customer_info && (
            <Card className="shadow-lg rounded-2xl border border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1 text-sm">
                <p>
                  <b>Name:</b> {customer_info.name}
                </p>
                <p>
                  <b>Email:</b>{" "}
                  <a
                    href={`mailto:${customer_info.email}`}
                    className="text-blue-600 hover:underline"
                  >
                    {customer_info.email}
                  </a>
                </p>
                <p>
                  <b>Phone:</b> {customer_info.phone}
                </p>
                <p>
                  <b>Address:</b> {customer_info.address}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Product Table  */}
          {lineItems.length > 0 && (
            <Card className="shadow-lg rounded-2xl border border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">
                  Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-2 px-3">Product</th>
                      <th className="px-3">SKU</th>
                      <th className="px-3">Qty</th>
                      <th className="px-3">Unit Price</th>
                      <th className="px-3">Supplier</th>
                      <th className="px-3">Courier</th>
                      <th className="px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item) => (
                      <tr key={item.id} className="border-t hover:bg-gray-50">
                        <td className="py-2 px-3">{item.product}</td>
                        <td className="px-3">{item.sku}</td>
                        <td className="px-3">{item.quantity}</td>
                        <td className="px-3">${item.unitPrice}</td>
                        <td className="px-3">
                          {item.status === "Manifest Generated" ? (
                            <span className="text-gray-700">
                              {item.suppliers.find(
                                (s) => s.supplier_id === item.supplierId
                              )?.supplier_name ||
                                item.supplierName ||
                                "—"}
                            </span>
                          ) : (
                            <Select
                              value={
                                item.suppliers.find(
                                  (s) => s.supplier_id === item.supplierId
                                ) || null
                              }
                              onChange={(option) =>
                                handleSupplierChange(
                                  item.id,
                                  option?.supplier_id || ""
                                )
                              }
                              options={item.suppliers}
                              getOptionLabel={(option) => option.supplier_name}
                              getOptionValue={(option) => option.supplier_id}
                              placeholder={
                                item.suppliers.length
                                  ? "Select supplier"
                                  : "No suppliers available"
                              }
                              isSearchable
                              menuPortalTarget={document.body}
                              styles={{
                                menuPortal: (base) => ({
                                  ...base,
                                  zIndex: 9999,
                                }),
                              }}
                            />
                          )}
                        </td>

                        <td className="px-3">
                          {item.status === "Manifest Generated" ? (
                            <span className="text-gray-700">
                              {item.courierName || "—"}
                            </span>
                          ) : (
                            <Select
                              value={
                                item.availableCouriers?.find(
                                  (c) =>
                                    String(c.courier_id) ===
                                      String(item.courierId) ||
                                    c.courier_name === item.courierName
                                ) || null
                              }
                              onChange={(option) =>
                                handleCourierChange(
                                  item.id,
                                  option?.courier_id || ""
                                )
                              }
                              options={item.availableCouriers || []}
                              getOptionLabel={(option) => option.courier_name}
                              getOptionValue={(option) => option.courier_id}
                              placeholder={
                                item.availableCouriers?.length
                                  ? "Select courier"
                                  : "No couriers available"
                              }
                              isSearchable
                              menuPortalTarget={document.body}
                              styles={{
                                menuPortal: (base) => ({
                                  ...base,
                                  zIndex: 9999,
                                }),
                              }}
                            />
                          )}
                        </td>
                        <td className="px-3">
                          <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-700">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t bg-gray-100 font-semibold">
                      <td className="py-2 px-3 text-right" colSpan={2}>
                        Totals:
                      </td>
                      <td className="px-3">{totalQuantity}</td>
                      <td className="px-3">${totalAmount}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Generate Manifest & Label Button  */}
          {!loading && (
            <div className="flex justify-end">
              <Button
                className="bg-green-600 hover:bg-green-700 text-white relative"
                onClick={handleClick}
                disabled={buttonLoading || allGenerated}
              >
                {buttonLoading ? (
                  <Loader2 className="animate-spin h-5 w-5 absolute inset-0 m-auto" />
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Generate Manifest & Label
                  </>
                )}
              </Button>
              <ConfirmDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                title="Generate Manifest & Label"
                description="Are you sure you want to generate the manifest and label for this order?"
                confirmText="Yes, Generate"
                cancelText="Cancel"
                confirmColor="green"
                onConfirm={handleConfirm}
                loading={buttonLoading}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

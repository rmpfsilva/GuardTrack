import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileText, Upload, X, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CompanySettings } from "@shared/schema";

const invoiceSettingsSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  companyAddress: z.string().optional(),
  companyEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  companyPhone: z.string().optional(),
  taxId: z.string().optional(),
  registrationNumber: z.string().optional(),
  logoUrl: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankSortCode: z.string().optional(),
  invoiceNotes: z.string().optional(),
  invoicePrefix: z.string().optional(),
});

type InvoiceSettingsForm = z.infer<typeof invoiceSettingsSchema>;

export default function InvoiceSettings() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: settings, isLoading } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });

  const form = useForm<InvoiceSettingsForm>({
    resolver: zodResolver(invoiceSettingsSchema),
    defaultValues: {
      companyName: "",
      companyAddress: "",
      companyEmail: "",
      companyPhone: "",
      taxId: "",
      registrationNumber: "",
      logoUrl: "",
      bankName: "",
      bankAccountNumber: "",
      bankSortCode: "",
      invoiceNotes: "",
      invoicePrefix: "INV",
    },
  });

  // Reset form when settings data loads
  useEffect(() => {
    if (settings) {
      form.reset({
        companyName: settings.companyName || "",
        companyAddress: settings.companyAddress || "",
        companyEmail: settings.companyEmail || "",
        companyPhone: settings.companyPhone || "",
        taxId: settings.taxId || "",
        registrationNumber: settings.registrationNumber || "",
        logoUrl: settings.logoUrl || "",
        bankName: settings.bankName || "",
        bankAccountNumber: settings.bankAccountNumber || "",
        bankSortCode: settings.bankSortCode || "",
        invoiceNotes: settings.invoiceNotes || "",
        invoicePrefix: settings.invoicePrefix || "INV",
      });
    }
  }, [settings, form]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: InvoiceSettingsForm) => {
      return await apiRequest("PUT", "/api/company-settings", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invoice settings updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InvoiceSettingsForm) => {
    updateSettingsMutation.mutate(data);
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 2MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      form.setValue('logoUrl', base64, { shouldDirty: true });
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Loading invoice settings...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-invoice-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Invoice Information
        </CardTitle>
        <CardDescription>
          Configure company details that appear on generated invoices and printed reports
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Company Name */}
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ProForce Security & Events Ltd"
                      {...field}
                      data-testid="input-company-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Company Address */}
            <FormField
              control={form.control}
              name="companyAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Address</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="123 Security Street, London, UK"
                      {...field}
                      data-testid="input-company-address"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Contact Details */}
            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="companyEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="info@proforce.com"
                        {...field}
                        data-testid="input-company-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="companyPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Phone</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="+44 20 1234 5678"
                        {...field}
                        data-testid="input-company-phone"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Tax & Registration */}
            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="taxId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>VAT/Tax ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="GB123456789"
                        {...field}
                        data-testid="input-tax-id"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="registrationNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Registration Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="12345678"
                        {...field}
                        data-testid="input-registration-number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Logo Upload */}
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Logo</FormLabel>
                  <FormDescription>
                    Appears on all generated invoices and printed reports. Upload an image or paste a URL.
                  </FormDescription>
                  <FormControl>
                    <div className="space-y-3">
                      {/* Logo preview */}
                      {field.value && (
                        <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/30">
                          <img
                            src={field.value}
                            alt="Company logo preview"
                            className="h-12 max-w-[160px] object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            data-testid="img-logo-preview"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">Logo uploaded</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {field.value.startsWith('data:') ? 'Uploaded file' : field.value}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => { field.onChange(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                            data-testid="button-remove-logo"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}

                      {/* Upload button + URL input */}
                      <div className="flex gap-2">
                        <Input
                          placeholder="https://example.com/logo.png"
                          {...field}
                          data-testid="input-logo-url"
                        />
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoFileChange}
                          data-testid="input-logo-file"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          data-testid="button-upload-logo"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload
                        </Button>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Bank Details */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="bankName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Barclays Bank"
                        {...field}
                        data-testid="input-bank-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bankAccountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="12345678"
                          {...field}
                          data-testid="input-account-number"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bankSortCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sort Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="12-34-56"
                          {...field}
                          data-testid="input-sort-code"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Invoice Settings */}
            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="invoicePrefix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Prefix</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="INV"
                        {...field}
                        data-testid="input-invoice-prefix"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="invoiceNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Payment terms: Net 30 days. Late payments subject to 5% interest."
                      {...field}
                      data-testid="input-invoice-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={updateSettingsMutation.isPending}
              data-testid="button-save-invoice-settings"
            >
              {updateSettingsMutation.isPending ? "Saving..." : "Save Invoice Settings"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

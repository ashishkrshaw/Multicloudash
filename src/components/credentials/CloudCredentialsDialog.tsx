import { useState, useEffect } from "react";
import { useCredentials } from "@/context/CredentialsContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lock, ShieldCheck, Eye, EyeOff, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface CloudCredentialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CloudCredentialsDialog = ({ open, onOpenChange }: CloudCredentialsDialogProps) => {
  const { hasAwsCredentials, hasAzureCredentials, hasGcpCredentials, setCredentials, clearCredentials, getEncryptedCredentials } = useCredentials();
  
  // AWS
  const [awsAccessKey, setAwsAccessKey] = useState("");
  const [awsSecretKey, setAwsSecretKey] = useState("");
  const [awsRegion, setAwsRegion] = useState("us-east-1");
  const [showAwsSecret, setShowAwsSecret] = useState(false);
  
  // Azure
  const [azureSubscriptionId, setAzureSubscriptionId] = useState("");
  const [azureClientId, setAzureClientId] = useState("");
  const [azureClientSecret, setAzureClientSecret] = useState("");
  const [azureTenantId, setAzureTenantId] = useState("");
  const [showAzureSecret, setShowAzureSecret] = useState(false);
  
  // GCP
  const [gcpProjectId, setGcpProjectId] = useState("");
  const [gcpPrivateKey, setGcpPrivateKey] = useState("");
  const [gcpClientEmail, setGcpClientEmail] = useState("");
  const [showGcpKey, setShowGcpKey] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing credentials when dialog opens
  useEffect(() => {
    if (open) {
      const existingCreds = getEncryptedCredentials();
      
      // Load AWS credentials
      if (existingCreds.aws) {
        setAwsAccessKey(existingCreds.aws.accessKeyId || "");
        setAwsSecretKey(existingCreds.aws.secretAccessKey || "");
        setAwsRegion(existingCreds.aws.region || "us-east-1");
      }
      
      // Load Azure credentials
      if (existingCreds.azure) {
        setAzureSubscriptionId(existingCreds.azure.subscriptionId || "");
        setAzureClientId(existingCreds.azure.clientId || "");
        setAzureClientSecret(existingCreds.azure.clientSecret || "");
        setAzureTenantId(existingCreds.azure.tenantId || "");
      }
      
      // Load GCP credentials
      if (existingCreds.gcp) {
        setGcpProjectId(existingCreds.gcp.projectId || "");
        setGcpClientEmail(existingCreds.gcp.clientEmail || "");
        setGcpPrivateKey(existingCreds.gcp.privateKey || "");
      }
    }
  }, [open, getEncryptedCredentials]);

  const handleSaveAws = async () => {
    setError(null);
    setIsLoading(true);
    try {
      if (!awsAccessKey || !awsSecretKey) {
        throw new Error("Access Key and Secret Key are required");
      }
      await setCredentials("aws", {
        accessKeyId: awsAccessKey,
        secretAccessKey: awsSecretKey,
        region: awsRegion,
      });
      setAwsAccessKey("");
      setAwsSecretKey("");
      setAwsRegion("us-east-1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save AWS credentials");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAzure = async () => {
    setError(null);
    setIsLoading(true);
    try {
      if (!azureSubscriptionId || !azureClientId || !azureClientSecret || !azureTenantId) {
        throw new Error("All Azure fields are required");
      }
      await setCredentials("azure", {
        subscriptionId: azureSubscriptionId,
        clientId: azureClientId,
        clientSecret: azureClientSecret,
        tenantId: azureTenantId,
      });
      setAzureSubscriptionId("");
      setAzureClientId("");
      setAzureClientSecret("");
      setAzureTenantId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save Azure credentials");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveGcp = async () => {
    setError(null);
    setIsLoading(true);
    try {
      if (!gcpProjectId || !gcpPrivateKey || !gcpClientEmail) {
        throw new Error("All GCP fields are required");
      }
      await setCredentials("gcp", {
        projectId: gcpProjectId,
        privateKey: gcpPrivateKey,
        clientEmail: gcpClientEmail,
      });
      setGcpProjectId("");
      setGcpPrivateKey("");
      setGcpClientEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save GCP credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl max-w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Cloud Credentials
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Securely manage your cloud provider credentials. All data is encrypted client-side.
          </DialogDescription>
        </DialogHeader>

        <Alert className="text-xs sm:text-sm">
          <ShieldCheck className="h-3 w-3 sm:h-4 sm:w-4" />
          <AlertDescription className="text-[10px] sm:text-xs">
            <strong>End-to-end encryption:</strong> Your credentials are encrypted in your browser before
            storage. Backend only receives encrypted data and decrypts only when calling cloud APIs.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="aws" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="aws" className="gap-1 text-xs sm:text-sm">
              AWS {hasAwsCredentials && <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px]">✓</Badge>}
            </TabsTrigger>
            <TabsTrigger value="azure" className="gap-1">
              Azure {hasAzureCredentials && <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px]">✓</Badge>}
            </TabsTrigger>
            <TabsTrigger value="gcp" className="gap-1">
              GCP {hasGcpCredentials && <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px]">✓</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* AWS Tab */}
          <TabsContent value="aws" className="space-y-4">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="aws-access-key">Access Key ID</Label>
                  <Input
                    id="aws-access-key"
                    type="text"
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                    value={awsAccessKey}
                    onChange={(e) => setAwsAccessKey(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="aws-secret-key">Secret Access Key</Label>
                  <div className="relative">
                    <Input
                      id="aws-secret-key"
                      type={showAwsSecret ? "text" : "password"}
                      placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                      value={awsSecretKey}
                      onChange={(e) => setAwsSecretKey(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowAwsSecret(!showAwsSecret)}
                    >
                      {showAwsSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="aws-region">Default Region</Label>
                  <Input
                    id="aws-region"
                    type="text"
                    placeholder="us-east-1"
                    value={awsRegion}
                    onChange={(e) => setAwsRegion(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSaveAws} className="flex-1" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : hasAwsCredentials ? "Update" : "Save"}
                  </Button>
                  {hasAwsCredentials && (
                    <Button
                      onClick={() => clearCredentials("aws")}
                      variant="outline"
                      disabled={isLoading}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="policy">
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Required IAM Policy
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
{`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ce:GetCostAndUsage",
        "ec2:DescribeInstances",
        "s3:ListAllMyBuckets",
        "cloudwatch:GetMetricStatistics",
        "cloudtrail:LookupEvents"
      ],
      "Resource": "*"
    }
  ]
}`}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          {/* Azure Tab */}
          <TabsContent value="azure" className="space-y-4">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="azure-subscription">Subscription ID</Label>
                  <Input
                    id="azure-subscription"
                    type="text"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={azureSubscriptionId}
                    onChange={(e) => setAzureSubscriptionId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="azure-client-id">Client ID</Label>
                  <Input
                    id="azure-client-id"
                    type="text"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={azureClientId}
                    onChange={(e) => setAzureClientId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="azure-client-secret">Client Secret</Label>
                  <div className="relative">
                    <Input
                      id="azure-client-secret"
                      type={showAzureSecret ? "text" : "password"}
                      placeholder="Your client secret"
                      value={azureClientSecret}
                      onChange={(e) => setAzureClientSecret(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowAzureSecret(!showAzureSecret)}
                    >
                      {showAzureSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="azure-tenant">Tenant ID</Label>
                  <Input
                    id="azure-tenant"
                    type="text"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={azureTenantId}
                    onChange={(e) => setAzureTenantId(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSaveAzure} className="flex-1" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : hasAzureCredentials ? "Update" : "Save"}
                  </Button>
                  {hasAzureCredentials && (
                    <Button
                      onClick={() => clearCredentials("azure")}
                      variant="outline"
                      disabled={isLoading}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="policy">
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Required Azure Permissions
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-xs">
                    <p className="font-medium">Service Principal needs these roles:</p>
                    <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                      <li>Reader (for resource enumeration)</li>
                      <li>Cost Management Reader (for billing data)</li>
                      <li>Monitoring Reader (for metrics)</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          {/* GCP Tab */}
          <TabsContent value="gcp" className="space-y-4">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="gcp-project">Project ID</Label>
                  <Input
                    id="gcp-project"
                    type="text"
                    placeholder="my-project-123456"
                    value={gcpProjectId}
                    onChange={(e) => setGcpProjectId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gcp-email">Service Account Email</Label>
                  <Input
                    id="gcp-email"
                    type="text"
                    placeholder="service-account@project.iam.gserviceaccount.com"
                    value={gcpClientEmail}
                    onChange={(e) => setGcpClientEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gcp-key">Private Key</Label>
                  <div className="relative">
                    <Input
                      id="gcp-key"
                      type={showGcpKey ? "text" : "password"}
                      placeholder="-----BEGIN PRIVATE KEY-----..."
                      value={gcpPrivateKey}
                      onChange={(e) => setGcpPrivateKey(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowGcpKey(!showGcpKey)}
                    >
                      {showGcpKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSaveGcp} className="flex-1" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : hasGcpCredentials ? "Update" : "Save"}
                  </Button>
                  {hasGcpCredentials && (
                    <Button
                      onClick={() => clearCredentials("gcp")}
                      variant="outline"
                      disabled={isLoading}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="policy">
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Required GCP Permissions
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-xs">
                    <p className="font-medium">Service Account needs these roles:</p>
                    <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                      <li>Cloud Billing Viewer</li>
                      <li>Compute Viewer</li>
                      <li>Storage Object Viewer</li>
                      <li>Monitoring Viewer</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>
        </Tabs>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
};

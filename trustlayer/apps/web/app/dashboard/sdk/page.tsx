import { Panel } from "../../../components/shell";

export default function SdkPage() {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Install" description="Add the public SDK package to any bank backend or server-side integration.">
        <pre className="overflow-auto rounded-2xl bg-[var(--ink)] p-5 text-sm text-white">{`npm install @hamduktrustlayerai/sdk`}</pre>
      </Panel>
      <Panel title="Quick Start" description="Minimal transaction-analysis example using the published package name.">
        <pre className="overflow-auto rounded-2xl bg-[var(--ink)] p-5 text-sm text-white">{`import TrustLayer from "@hamduktrustlayerai/sdk";

const tl = new TrustLayer({
  apiKey: "tl_live_...",
  baseUrl: process.env.TRUSTLAYER_API_URL
});

const result = await tl.transaction.analyze({
  customer_id: "customer_123",
  amount: 300000,
  currency: "NGN",
  merchant: "POS Terminal",
  location: "Abuja",
  device_id: "device_abc",
  channel: "mobile"
});

console.log(result.data.decision);`}</pre>
      </Panel>
     
    </div>
  );
}

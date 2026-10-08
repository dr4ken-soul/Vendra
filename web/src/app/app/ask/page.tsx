import type { Metadata } from 'next';
import { requireShop, requireUser, can } from '@/lib/tenancy';
import { AskConversation } from '@/components/app/AskConversation';
import { PageHeader } from '@/components/app/ui';

export const metadata: Metadata = { title: 'Ask Vendra' };
export const dynamic = 'force-dynamic';

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const user = await requireUser('/app/ask');
  const params = await searchParams;
  const { shop, membership } = await requireShop(user.userId, params.shop, '/app/ask');

  return (
    <>
      <PageHeader
        headingId="page-heading"
        title="Ask Vendra"
        description="Ask about a past quote, delivery, issue or resolution. Answers link back to the deal record."
      />
      <AskConversation shopId={shop.id} canAsk={can(membership, 'assistant.ask')} />
    </>
  );
}
import { StyleAdEditorPageClient } from './style-ad-editor-page-client';

type MerchantStyleAdPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MerchantStyleAdPage({ params }: MerchantStyleAdPageProps) {
  const { id } = await params;
  return <StyleAdEditorPageClient styleId={id} />;
}

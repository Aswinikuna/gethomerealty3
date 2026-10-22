import { notFound } from 'next/navigation';
import ResourceForm from '@/components/ResourceForm';
import { RESOURCES } from '@/lib/resources';

type Props = { params: Promise<{ resource: string; id: string }> };

export async function generateMetadata({ params }: Props) {
  const { resource, id } = await params;
  const r = RESOURCES[resource];
  return { title: r ? (id === 'new' ? `Add ${r.singular.toLowerCase()}` : `Edit ${r.singular.toLowerCase()}`) : 'Not found' };
}

export default async function EditPage({ params }: Props) {
  const { resource, id } = await params;
  if (!Object.prototype.hasOwnProperty.call(RESOURCES, resource)) notFound();
  if (id !== 'new' && !/^\d+$/.test(id)) notFound();
  return <ResourceForm key={`${resource}-${id}`} resourceKey={resource} id={id} />;
}

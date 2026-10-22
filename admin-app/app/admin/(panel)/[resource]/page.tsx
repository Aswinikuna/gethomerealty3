import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import ResourceList from '@/components/ResourceList';
import { RESOURCES } from '@/lib/resources';

type Props = { params: Promise<{ resource: string }> };

export async function generateMetadata({ params }: Props) {
  const r = RESOURCES[(await params).resource];
  return { title: r?.label ?? 'Not found' };
}

export default async function ListPage({ params }: Props) {
  const { resource } = await params;
  if (!Object.prototype.hasOwnProperty.call(RESOURCES, resource)) notFound();
  return <Suspense><ResourceList resourceKey={resource} /></Suspense>;
}

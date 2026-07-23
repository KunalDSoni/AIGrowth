import { notFound } from "next/navigation";
import { recommendations } from "@/lib/data/demo";
import { RecommendationDetail } from "@/components/recommendation-detail";
export function generateStaticParams(){return recommendations.map(({id})=>({id}))}
export default async function RecommendationPage({params}:{params:Promise<{id:string}>}){const {id}=await params;const item=recommendations.find(x=>x.id===id);if(!item)notFound();return <RecommendationDetail item={item}/>}

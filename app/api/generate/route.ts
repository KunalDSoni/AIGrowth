import { NextResponse } from "next/server";
import { z } from "zod";
import { MockAITextProvider } from "@/lib/providers/mock";
const requestSchema=z.object({type:z.string().min(1).max(80),context:z.string().min(1).max(10000),tone:z.string().min(1).max(200)});
export async function POST(request:Request){const length=Number(request.headers.get("content-length")??0);if(length>20000)return NextResponse.json({error:"Request too large"},{status:413});const json:unknown=await request.json().catch(()=>null);const parsed=requestSchema.safeParse(json);if(!parsed.success)return NextResponse.json({error:"Invalid generation request"},{status:400});const provider=new MockAITextProvider();return NextResponse.json({data:await provider.generate(parsed.data),provider:"mock",publishReady:false})}

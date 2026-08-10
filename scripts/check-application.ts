import { prisma } from "@/lib/prisma";

async function main(){

const app =
await prisma.campaignApplication.findUnique({
where:{
id:"cmsfxgxnl00030p1693zdjdqe"
},
include:{
campaign:true,
creator:true,
},
});


console.log(
JSON.stringify(
app,
null,
2
)
);

}

main();


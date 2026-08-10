import { prisma } from "@/lib/prisma";

async function main(){

const links =
await prisma.trackingLink.findMany({
where:{
campaignId:"cmsfwycc000010p164psq8xii",
creatorId:"cmsfrib290001g616cn6irq58",
},
});

console.log(
JSON.stringify(
links,
null,
2
)
);

}

main();


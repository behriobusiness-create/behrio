import { prisma } from "@/lib/prisma";

async function main(){

  const campaign =
    await prisma.campaign.findUnique({
      where:{
        id:"cmsfwycc000010p164psq8xii",
      },

      select:{
        id:true,
        name:true,
        budget:true,
        spentAmount:true,
        status:true,
      },
    });


  console.log(
    JSON.stringify(
      campaign,
      null,
      2
    )
  );

}

main();

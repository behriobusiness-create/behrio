import { prisma } from "@/lib/prisma";

async function main() {

  const admins = await prisma.user.findMany({
    where:{
      role:"ADMIN",
    },
    select:{
      id:true,
      email:true,
      name:true,
      role:true,
    },
  });


  console.log(
    JSON.stringify(
      admins,
      null,
      2
    )
  );

}

main();


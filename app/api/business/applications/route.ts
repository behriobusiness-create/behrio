import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";


export async function GET() {

  try {

    const user = await getCurrentUser();


    if (!user) {
      return NextResponse.json(
        {
          error:"احراز هویت انجام نشده است.",
        },
        {
          status:401,
        },
      );
    }



    const fullUser =
      await prisma.user.findUnique({
        where:{
          id:user.id,
        },
        include:{
          businessProfile:true,
        },
      });



    if(
      !fullUser ||
      fullUser.role !== "BUSINESS" ||
      !fullUser.businessProfile
    ){
      return NextResponse.json(
        {
          error:"دسترسی غیرمجاز.",
        },
        {
          status:403,
        },
      );
    }



    const applications =
      await prisma.campaignApplication.findMany({

        where:{
          campaign:{
            businessId:
              fullUser.businessProfile.id,
          },
        },


        include:{

          campaign:{
            select:{
              id:true,
              name:true,
            },
          },


          creator:{
            select:{
              id:true,
              displayName:true,
            },
          },

        },


        orderBy:{
          appliedAt:"desc",
        },

      });



    return NextResponse.json({
      applications,
    });



  } catch(error){

    console.error(
      "Business applications error:",
      error,
    );


    return NextResponse.json(
      {
        error:"خطا در دریافت درخواست‌ها.",
      },
      {
        status:500,
      },
    );
  }
}

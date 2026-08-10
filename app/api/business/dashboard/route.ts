import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";


export async function GET() {

  try {

    const user = await getCurrentUser();


    if (!user) {
      return NextResponse.json(
        {
          error:"احراز هویت انجام نشده است."
        },
        {
          status:401
        }
      );
    }


    const fullUser =
      await prisma.user.findUnique({
        where:{
          id:user.id,
        },

        select:{
          role:true,

          businessProfile:{
            select:{
              id:true,
              companyName:true,
            },
          },
        },
      });


    if(
      !fullUser ||
      fullUser.role !== "BUSINESS" ||
      !fullUser.businessProfile
    ){
      return NextResponse.json(
        {
          error:"فقط Business ها دسترسی دارند."
        },
        {
          status:403
        }
      );
    }


    const businessId =
      fullUser.businessProfile.id;


    const campaigns =
      await prisma.campaign.findMany({

        where:{
          businessId,
        },

        include:{
          _count:{
            select:{
              applications:true,
            },
          },

        },

        orderBy:{
          createdAt:"desc",
        },

      });


    const clicks =
      await prisma.click.count({
        where:{
          trackingLink:{
            campaign:{
              businessId,
            },
          },
        },
      });


    const conversions =
      await prisma.conversion.count({
        where:{
          campaign:{
            businessId,
          },
          status:"APPROVED",
        },
      });


    const spent =
      await prisma.campaign.aggregate({
        where:{
          businessId,
        },

        _sum:{
          spentAmount:true,
        },
      });



    return NextResponse.json({

      business:{
        id:businessId,
        name:
          fullUser.businessProfile.companyName,
      },


      stats:{
        campaigns:
          campaigns.length,

        clicks,

        conversions,

        spent:
          Number(
            spent._sum.spentAmount ?? 0
          ),
      },


      campaigns,

    });


  } catch(error){

    console.error(
      "Business dashboard error:",
      error
    );


    return NextResponse.json(
      {
        error:"خطا در دریافت داشبورد."
      },
      {
        status:500
      }
    );

  }

}

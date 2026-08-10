import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";


export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {

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



    const { id: campaignId } =
      await context.params;



    const campaign =
      await prisma.campaign.findUnique({
        where:{
          id:campaignId,
        },
      });



    if(
      !campaign ||
      campaign.businessId !== fullUser.businessProfile.id
    ){
      return NextResponse.json(
        {
          error:"Campaign پیدا نشد.",
        },
        {
          status:404,
        },
      );
    }



    const clicks =
      await prisma.click.count({
        where:{
          trackingLink:{
            campaignId,
          },
        },
      });



    const conversions =
      await prisma.conversion.count({
        where:{
          campaignId,
          status:"APPROVED",
        },
      });



    const spent =
      await prisma.ledgerEntry.aggregate({
        _sum:{
          amount:true,
        },

        where:{
          campaignId,
          type:"CREATOR_EARNING",
          status:{
            in:[
              "AVAILABLE",
              "COMPLETED",
            ],
          },
        },
      });



    const creatorStats =
  await prisma.trackingLink.findMany({

    where:{
      campaignId,
    },

    include:{
      creator:{
        select:{
          displayName:true,
        },
      },

      clicks:true,

      conversions:{
        where:{
          status:"APPROVED",
        },
      },

    },

  });



const creatorCount =
  creatorStats.length;



const creatorBreakdown =
  creatorStats.map((link)=>({

    name:
      link.creator.displayName,

    clicks:
      link.clicks.length,

    conversions:
      link.conversions.length,

    earned:
      link.conversions.reduce(
        (sum,item)=>
          sum + Number(item.amount ?? 0),
        0
      ),

  }));



    return NextResponse.json({

      campaign:{
        id:campaign.id,
        name:campaign.name,
      },

      stats:{

        clicks,

        conversions,

        creators: creatorCount,
          

        spent:
          Number(
            spent._sum.amount ?? 0
          ),

      },

        creatorBreakdown,

    });



  } catch(error){

    console.error(
      "Campaign stats error:",
      error,
    );


    return NextResponse.json(
      {
        error:"خطا در دریافت آمار.",
      },
      {
        status:500,
      },
    );
  }

}

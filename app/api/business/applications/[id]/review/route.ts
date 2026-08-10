import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import {
  campaignHasCapacity,
  lockCampaignForCapacityCheck,
} from "@/lib/campaign/capacity";


export async function POST(
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


    const { id } =
      await context.params;


    const body =
      await request.json();


    const {
      action,
    } = body;



    const application =
      await prisma.campaignApplication.findUnique({
        where:{
          id,
        },
        include:{
          campaign:true,
        },
      });



    if(!application){
      return NextResponse.json(
        {
          error:"Application پیدا نشد.",
        },
        {
          status:404,
        },
      );
    }



    if(
      application.campaign.businessId !==
      fullUser.businessProfile.id
    ){
      return NextResponse.json(
        {
          error:"این کمپین متعلق به شما نیست.",
        },
        {
          status:403,
        },
      );
    }


    if(application.status !== "PENDING"){
      return NextResponse.json(
        {
          error:"این درخواست قبلاً بررسی شده است.",
        },
        {
          status:400,
        },
      );
    }


    if(application.campaign.status !== "ACTIVE"){
      return NextResponse.json(
        {
          error:"کمپین فعال نیست.",
        },
        {
          status:400,
        },
      );
    }

    if(action === "APPROVE"){
      const capacityResult =
        await prisma.$transaction(async (tx) => {
          const campaign =
            await lockCampaignForCapacityCheck(
              tx,
              application.campaignId,
            );

          if(!campaign){
            return {
              ok:false as const,
              reason:"کمپین پیدا نشد.",
            };
          }

          return campaignHasCapacity(campaign);
        });

      if(!capacityResult.ok){
        return NextResponse.json(
          {
            error:capacityResult.reason,
          },
          {
            status:400,
          },
        );
      }

      const updated =
        await prisma.campaignApplication.update({
          where:{
            id,
          },
          data:{
            status:"APPROVED",
            reviewedAt:new Date(),
          },
        });



      let trackingLink =
  await prisma.trackingLink.findUnique({
    where:{
      campaignId_creatorId:{
        campaignId:
          application.campaignId,

        creatorId:
          application.creatorId,
      },
    },
  });


if(!trackingLink){

  const code =
    randomBytes(6)
    .toString("hex");


  trackingLink =
    await prisma.trackingLink.create({
      data:{
        campaignId:
          application.campaignId,

        creatorId:
          application.creatorId,

        code,

        status:"ACTIVE",
      },
    });

}



      return NextResponse.json({
        ok:true,
        application:updated,
        trackingLink,
      });

    }



    if(action === "REJECT"){


      const updated =
        await prisma.campaignApplication.update({
          where:{
            id,
          },
          data:{
            status:"REJECTED",
            reviewedAt:new Date(),
          },
        });



      return NextResponse.json({
        ok:true,
        application:updated,
      });

    }



    return NextResponse.json(
      {
        error:"Action نامعتبر است.",
      },
      {
        status:400,
      },
    );



  } catch(error){

    console.error(
      "Review application error:",
      error,
    );


    return NextResponse.json(
      {
        error:"خطا در بررسی درخواست.",
      },
      {
        status:500,
      },
    );
  }
}

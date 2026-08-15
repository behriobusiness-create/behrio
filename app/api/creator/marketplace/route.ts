import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";


export async function GET(
  request: Request,
) {

  try {

    const user = await getCurrentUser();


    if (!user) {
      return NextResponse.json(
        {
          error:
            "احراز هویت انجام نشده است.",
        },
        {
          status:401,
        },
      );
    }


    const { searchParams } =
      new URL(request.url);


    const q =
      searchParams.get("q");


    const now = new Date();

    const campaigns =
      await prisma.campaign.findMany({

        where: {

          status:"ACTIVE",
          type:"CPM",

          AND: [
            {
              OR: [{ startAt: null }, { startAt: { lte: now } }],
            },
            {
              OR: [{ endAt: null }, { endAt: { gte: now } }],
            },
          ],


          ...(q && {
            name:{
              contains:q,
              mode:"insensitive",
            },
          }),

        },


        include:{
          business:{
            select:{
              companyName:true,
            },
          },
        },


        orderBy:{
          createdAt:"desc",
        },

      });

    const eligibleCampaigns = campaigns.filter(
      (c) => Number(c.budget) > Number(c.spentAmount),
    );

    return NextResponse.json({
      campaigns: eligibleCampaigns,
    });



  } catch(error){

    console.error(
      "Marketplace error:",
      error,
    );


    return NextResponse.json(
      {
        error:
          "خطا در دریافت کمپین‌ها.",
      },
      {
        status:500,
      },
    );
  }
}

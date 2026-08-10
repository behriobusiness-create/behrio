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


    if (user.role !== "ADMIN") {
      return NextResponse.json(
        {
          error:"دسترسی ادمین لازم است."
        },
        {
          status:403
        }
      );
    }



    const users =
      await prisma.user.count();


    const creators =
      await prisma.creatorProfile.count();


    const businesses =
      await prisma.businessProfile.count();


    const campaigns =
      await prisma.campaign.count();



    const pendingWithdrawals =
      await prisma.withdrawal.count({
        where:{
          status:"REQUESTED",
        },
      });



    const paid =
      await prisma.withdrawal.aggregate({
        where:{
          status:"COMPLETED",
        },

        _sum:{
          amount:true,
        },
      });



    return NextResponse.json({

      stats:{

        users,

        creators,

        businesses,

        campaigns,

        pendingWithdrawals,

        totalPaid:
          Number(
            paid._sum.amount ?? 0
          ),

      },

    });


  } catch(error){

    console.error(
      "Admin dashboard error:",
      error
    );


    return NextResponse.json(
      {
        error:"خطا در داشبورد ادمین."
      },
      {
        status:500
      }
    );

  }

}

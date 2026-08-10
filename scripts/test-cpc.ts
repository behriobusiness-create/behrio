import { createCpcEarning } from "../lib/earnings/cpc";

async function main() {
  const result = await createCpcEarning(
    "cmsfrkvtk0000is16lvbig7xy"
  );

  console.log(result);
}

main()
  .catch((error) => {
    console.error(error);
  });

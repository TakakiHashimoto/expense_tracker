import Image from "next/image";

type props = { icon: string; alt: string; title: string; description: string };

function Description({ icon, alt, title, description }: props) {
  return (
    <div>
      <Image src={icon} alt={alt} width={9} height={9} />
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default Description;

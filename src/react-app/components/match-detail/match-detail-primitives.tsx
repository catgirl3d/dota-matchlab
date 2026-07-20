type DetailHeadingProps = {
  eyebrow: string;
  title: string;
  id: string;
};

export function DetailHeading({ eyebrow, title, id }: DetailHeadingProps) {
  return (
    <div className="detail-heading">
      <span className="micro-label">{eyebrow}</span>
      <h3 id={id}>{title}</h3>
    </div>
  );
}

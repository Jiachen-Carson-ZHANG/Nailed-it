type PhoneMockupProps = {
  labelledBy: string;
};

export function PhoneMockup({ labelledBy }: PhoneMockupProps) {
  return (
    <div aria-labelledby={labelledBy} role="img">
      <div aria-hidden="true">
        <div />
      </div>
      <div aria-hidden="true" />
      <div aria-hidden="true" />
    </div>
  );
}

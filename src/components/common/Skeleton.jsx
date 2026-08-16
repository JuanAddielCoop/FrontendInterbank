const Skeleton = ({ rows = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="animate-pulse rounded-2xl bg-[#151822] p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-dark-border" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded-full bg-dark-border" />
            <div className="h-3 w-1/3 rounded-full bg-dark-border" />
          </div>
          <div className="h-4 w-20 rounded-full bg-dark-border" />
        </div>
      </div>
    ))}
  </div>
)

export default Skeleton

"use client"

import * as React from "react"
import cx from "classnames"

const Slider = React.forwardRef(({ className, value, onValueChange, max = 100, min = 1, step = 1, ...props }, ref) => {
    const handleChange = (e) => {
        const newValue = Number.parseInt(e.target.value)
        onValueChange && onValueChange([newValue])
    }

    return (
        <div className={cx("relative flex w-full touch-none select-none items-center", className)}>
            <input
                ref={ref}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value?.[0] || 1}
                onChange={handleChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                {...props}
            />
            <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          transition: all 0.3s ease;
        }
        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          cursor: pointer;
          border: none;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        .slider:focus {
          outline: none;
        }
        .slider:focus::-webkit-slider-thumb {
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
        }
      `}</style>
        </div>
    )
})
Slider.displayName = "Slider"

export { Slider }


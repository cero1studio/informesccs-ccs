'use client';

import * as React from 'react';
import { format, subDays, startOfWeek, startOfMonth, startOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DatePickerWithRangeProps {
  className?: string;
  date: DateRange | undefined;
  setDate: (date: DateRange | undefined) => void;
}

export function DatePickerWithRange({
  className,
  date,
  setDate,
}: DatePickerWithRangeProps) {
  const handlePresetChange = (value: string) => {
    const today = new Date();
    let from = today;
    switch (value) {
      case 'hoy':
        from = today;
        break;
      case 'ayer':
        from = subDays(today, 1);
        setDate({ from, to: from });
        return;
      case '7':
        from = subDays(today, 7);
        break;
      case '15':
        from = subDays(today, 15);
        break;
      case '30':
        from = subDays(today, 30);
        break;
      case 'este_mes':
        from = startOfMonth(today);
        break;
      case 'este_ano':
        from = startOfYear(today);
        break;
      default:
        break;
    }
    setDate({ from, to: today });
  };

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            className={cn(
              'w-[300px] justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, 'LLL dd, y', { locale: es })} -{' '}
                  {format(date.to, 'LLL dd, y', { locale: es })}
                </>
              ) : (
                format(date.from, 'LLL dd, y', { locale: es })
              )
            ) : (
              <span>Filtrar por fechas</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col space-y-2 p-2 border-b">
            <Select onValueChange={handlePresetChange}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar rápido..." />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="hoy">Hoy</SelectItem>
                <SelectItem value="ayer">Ayer</SelectItem>
                <SelectItem value="7">Últimos 7 días</SelectItem>
                <SelectItem value="15">Últimos 15 días</SelectItem>
                <SelectItem value="30">Últimos 30 días</SelectItem>
                <SelectItem value="este_mes">Este Mes</SelectItem>
                <SelectItem value="este_ano">Este Año</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
            locale={es}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

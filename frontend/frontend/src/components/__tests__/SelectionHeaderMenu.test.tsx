import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../shadcn/dropdown-menu'
import { Button } from '../shadcn/button'

describe('DropdownMenu item handlers', () => {
    it('onSelect fires on click', async () => {
        const onSelect = vi.fn()
        render(
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button>Open</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onSelect={onSelect}>Item</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )
        await userEvent.click(screen.getByText('Open'))
        await userEvent.click(await screen.findByText('Item'))
        expect(onSelect).toHaveBeenCalledTimes(1)
    })

    it('onClick fires on click', async () => {
        const onClick = vi.fn()
        render(
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button>Open</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onClick={onClick}>Item</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )
        await userEvent.click(screen.getByText('Open'))
        await userEvent.click(await screen.findByText('Item'))
        expect(onClick).toHaveBeenCalledTimes(1)
    })
})

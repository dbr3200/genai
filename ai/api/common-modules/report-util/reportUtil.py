'''
Utility to generate PDF reports using FPDF2
https://pyfpdf.github.io/fpdf2/index.html
'''
import logging
from datetime import datetime, timezone
from fpdf import FPDF

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

class PDF(FPDF):
    '''
    Report Util used for generating PDF documents
    '''

    def __init__(self, orientation, resource_id, resource_name):
        super().__init__(orientation=orientation)
        self.resource_id = resource_id
        self.resource_name = resource_name

    def footer(self):
        '''
        Generates a footer with page no on every PDF page
        '''
        LOGGER.info("In reportUtil.footer, starting method")
        # Position cursor at 1.5 cm from bottom:
        self.set_y(-15)
        # Setting font: helvetica italic 8
        self.set_font("helvetica", "I", 8)
        # Printing page number:
        self.cell(0, 10, f"{self.resource_name}Id - {self.resource_id}", align="L")
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="R")
        LOGGER.info("In reportUtil.footer, exiting method")

    def report_header(self, report_name, user_name, total_documents, completed_documents, failed_documents, resource_id, job_run_id, resource_name):
        '''
        Renders Amorphic logo on top of the first page
        '''
        LOGGER.info("In reportUtil.report_header, report name is %s", report_name)
        # Rendering logo:
        self.image("/var/lang/lib/python3.12/site-packages/amorphic.jpeg", 10, 12, 70, 25)
        self.ln(35)
        self.set_text_color(1, 97, 202) #blue
        self.cell(txt= "Report on {} UTC".format(datetime.now(timezone.utc).strftime("%B %d, %Y %H:%M")), border=0, align="L")
        self.ln(25)
        self.set_text_color(146, 148, 152) #grey
        self.set_font_size( 22 )
        self.cell(w=0, txt=report_name, align="C")
        self.ln(10)
        self.set_font_size( 10 )
        self.cell(w = 0, txt = "{} run triggered by {}".format(resource_name, user_name), align = 'C')
        self.ln(10)
        self.cell(w = 0, txt = "{}Id:{}, RunId:{}".format(resource_name,resource_id, job_run_id), align = 'C')
        self.ln(10)
        self.set_text_color(1, 97, 202) #blue
        if total_documents:
            self.cell(w=0, txt=f'Total Documents: {total_documents}', align="L")
            self.ln(5)
            self.cell(w=0, txt=f'Completed Documents: {completed_documents}', align="L")
            self.ln(5)
            self.cell(w=0, txt=f'Failed Documents: {failed_documents}', align="L")
            self.ln(10)
        LOGGER.info("In reportUtil.report_header, exiting method")


    def report_footer_note(self, notes):
        '''
        Adds the given notes at the end of pdf report
        '''
        LOGGER.info("In reportUtil.table_footer, starting method")
        self.set_font("helvetica", "I")
        self.cell(w=0, txt=notes, align="L")
        self.ln(4)
        self.ln(10)
        self.set_font("helvetica")
        LOGGER.info("In reportUtil.table_footer, exiting method")

    def print_row(self, col_widths, row, line_height, fill):
        '''
        Prints a row in a table
        '''
        LOGGER.info("In reportUtil.print_row, row data is %s", row)
        row_height_lines = 1
        lines_in_row = []
        updated_row = []
        for col_width, row_data in zip(col_widths, row):
            # determine height of highest cell
            output = self.multi_cell(col_width, line_height, row_data, align="L", ln=3, split_only=True)
            lines_in_row.append(len(output))
            updated_row.append(output)
            if len(output) > row_height_lines:
                row_height_lines = len(output)

        for i, line_count in enumerate(lines_in_row):
            #adding \n character to row's columns which have height less than the max column height for better formating
            if line_count != row_height_lines:
                updated_row[i][-1] += '\n'
            #adding \n to rows's column data so that each column has the same height
            while line_count < row_height_lines:
                line_count+=1
                updated_row[i].append('\n')

        LOGGER.info("In reportUtil.print_row, updated row = %s",updated_row)

        lines_left_to_be_printed = row_height_lines

        #printing the lines that can be printed on the space left of the page iteratively
        while lines_left_to_be_printed > 0:

            LOGGER.info('In reportUtil.print_row, lines_left to be printed = %s',lines_left_to_be_printed)
            space_left = self.eph - self.get_y()

            if line_height >= space_left:
                self.ln()
                self.add_page()
                space_left = self.eph - self.get_y()
            LOGGER.info("In reportUtil.print_row, space_left = %s",space_left)

            # rows that can be printed in the space left on the page
            lines_that_can_be_printed = int(space_left//line_height)
            LOGGER.info('In reportUtil.print_row, lines that can be printed = %s',lines_that_can_be_printed)
            for i, row_data in enumerate(updated_row):
                end_index = min(lines_left_to_be_printed,lines_that_can_be_printed)
                text = " ".join(row_data[:end_index])
                self.multi_cell(col_widths[i], line_height, text, align="L", ln=3, fill=fill)
                if lines_left_to_be_printed > lines_that_can_be_printed:
                    updated_row[i] = row_data[lines_that_can_be_printed:]
            self.ln(min(lines_that_can_be_printed,lines_left_to_be_printed) * line_height)
            # updating the lines left to be printed
            lines_left_to_be_printed -= lines_that_can_be_printed
        LOGGER.info("In reportUtil.print_row, exiting method")


    def colored_table(self, headings, rows):
        '''
        Renders a table with the provided data
        '''
        LOGGER.info("In reportUtil.colored_table, heading and rows are %s, %s", headings, rows)
        col_widths = [self.epw/len(headings) for h in headings]
        self.set_fill_color(1, 97, 202)
        self.set_text_color(255)
        self.set_draw_color(255, 0, 0)
        self.set_font_size( 12 )
        line_height = self.font_size * 1.5
        #print heading with fill color
        self.print_row(col_widths, headings, line_height, True)
        # Color and font restoration:
        self.set_fill_color(224, 235, 255)
        self.set_text_color(146, 148, 152)
        self.set_font_size(10)
        fill = False

        for row in rows:
            self.print_row(col_widths, row, line_height, fill)
            fill = not fill
        self.cell(sum(col_widths), 0, "", "T")
        self.ln(10)

        LOGGER.info("In reportUtil.colored_table, exiting method")

    def colored_heading(self, message_type, text):
        '''
        Renders a table with the provided data and fill color based on message_type
        message_type can be info, success, failure
        '''
        LOGGER.info("In reportUtil.colored_heading, message_type and text are %s, %s", message_type, text)
        if message_type == "success":
            self.set_fill_color(84, 187, 84)
        elif message_type == "failure":
            self.set_fill_color(255, 99, 71)
        else:
            #default to info heading
            self.set_fill_color(173, 216, 230)
        self.set_text_color(255)
        self.set_draw_color(255, 0, 0)
        self.set_font_size(12)
        line_height = self.font_size * 1.5
        self.cell(w=0, h=line_height, txt=text, align="C", fill=True)
        self.ln()
        LOGGER.info("In reportUtil.colored_heading, exiting method")
